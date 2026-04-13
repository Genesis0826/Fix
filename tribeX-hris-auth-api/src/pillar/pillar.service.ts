import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PillarCVParseResponse {
  success: boolean;
  data?: {
    name: string;
    email: string;
    phone: string;
    skills: Array<{
      name: string;
      level: string; // 'beginner', 'intermediate', 'advanced', 'expert'
      yearsOfExperience: number;
    }>;
    education: Array<{
      institution: string;
      degree: string;
      field: string;
      graduationYear: number;
    }>;
    experience: Array<{
      company: string;
      position: string;
      description: string;
      startDate: string;
      endDate: string;
    }>;
    summary: string;
  };
  error?: string;
}

export interface ExtractedSfiaSkill {
  skill_name: string;
  candidate_level: number; // 1-4 mapping to SFIA levels
  years_of_experience: number;
  extracted_from: 'cv_text' | 'job_description';
  confidence_score: number; // 0-1
}

@Injectable()
export class PillarService {
  private readonly logger = new Logger(PillarService.name);
  private readonly pillarApiUrl: string;
  private readonly pillarApiKey: string;
  private readonly mockMode: boolean;

  constructor(private readonly configService: ConfigService) {
    this.pillarApiUrl =
      this.configService.get('PILLAR_API_URL') || 'https://api.pillarhr.com';
    this.pillarApiKey = this.configService.get('PILLAR_API_KEY') || '';
    this.mockMode = !this.pillarApiKey; // Enable mock mode if no API key

    if (this.mockMode) {
      this.logger.warn(
        '⚠️ PILLAR_API_KEY not configured. Running in MOCK MODE for CV parsing.',
      );
    }
  }

  async parseCv(
    cvUrl: string,
    applicantName: string,
  ): Promise<PillarCVParseResponse> {
    if (this.mockMode) {
      return this.mockParseCv(cvUrl, applicantName);
    }

    try {
      const response = await fetch(`${this.pillarApiUrl}/v1/cv/parse`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.pillarApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cv_url: cvUrl,
          extract_skills: true,
          extract_experience: true,
          extract_education: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Pillar API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Pillar CV parse failed for ${applicantName}:`,
        errorMsg,
      );
      return {
        success: false,
        error: `Failed to parse CV: ${errorMsg}`,
      };
    }
  }

  async extractSfiaSkills(
    cvData: PillarCVParseResponse,
    jobSfiaSkills: Array<{ skill_name: string; required_level: number }>,
  ): Promise<ExtractedSfiaSkill[]> {
    if (!cvData.success || !cvData.data) {
      return [];
    }

    const extractedSkills: ExtractedSfiaSkill[] = [];

    // Map Pillar skill levels to SFIA candidate levels (1-4)
    const levelMapping: Record<string, number> = {
      beginner: 1,
      intermediate: 2,
      advanced: 3,
      expert: 4,
    };

    // For each SFIA job skill, check if CV mentions it
    for (const jobSkill of jobSfiaSkills) {
      const cvSkill = cvData.data.skills.find((s) =>
        s.name.toLowerCase().includes(jobSkill.skill_name.toLowerCase()),
      );

      if (cvSkill) {
        extractedSkills.push({
          skill_name: cvSkill.name,
          candidate_level: levelMapping[cvSkill.level] || 1,
          years_of_experience: cvSkill.yearsOfExperience || 0,
          extracted_from: 'cv_text',
          confidence_score: 0.95, // High confidence for explicit mention
        });
      }
    }

    // Second pass: keyword matching in experience descriptions
    const experienceText = cvData.data.experience
      .map((e) => `${e.position} ${e.description}`)
      .join(' ')
      .toLowerCase();

    for (const jobSkill of jobSfiaSkills) {
      if (!extractedSkills.some((s) => s.skill_name === jobSkill.skill_name)) {
        if (experienceText.includes(jobSkill.skill_name.toLowerCase())) {
          extractedSkills.push({
            skill_name: jobSkill.skill_name,
            candidate_level: 2, // Conservative estimate
            years_of_experience: 3,
            extracted_from: 'cv_text',
            confidence_score: 0.65, // Lower confidence for keyword match
          });
        }
      }
    }

    return extractedSkills;
  }

  async checkPillarHealth(): Promise<{
    healthy: boolean;
    responseTime: number;
    error?: string;
  }> {
    if (this.mockMode) {
      return { healthy: true, responseTime: 50 }; // Mock is always healthy
    }

    const startTime = Date.now();
    try {
      const response = await fetch(`${this.pillarApiUrl}/v1/health`, {
        headers: {
          Authorization: `Bearer ${this.pillarApiKey}`,
        },
      });

      const responseTime = Date.now() - startTime;
      return {
        healthy: response.ok,
        responseTime,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        healthy: false,
        responseTime: Date.now() - startTime,
        error: `Pillar health check failed: ${errorMsg}`,
      };
    }
  }

  private mockParseCv(
    cvUrl: string,
    applicantName: string,
  ): PillarCVParseResponse {
    // Mock CV parsing for testing
    return {
      success: true,
      data: {
        name: applicantName,
        email: `${applicantName.replace(' ', '.')}@example.com`,
        phone: '+1-234-567-8900',
        skills: [
          { name: 'JavaScript', level: 'advanced', yearsOfExperience: 5 },
          { name: 'TypeScript', level: 'intermediate', yearsOfExperience: 3 },
          { name: 'React', level: 'advanced', yearsOfExperience: 4 },
          { name: 'Node.js', level: 'intermediate', yearsOfExperience: 4 },
        ],
        education: [
          {
            institution: 'University Example',
            degree: 'Bachelor',
            field: 'Computer Science',
            graduationYear: 2018,
          },
        ],
        experience: [
          {
            company: 'Tech Corp',
            position: 'Senior Developer',
            description:
              'Developed full-stack applications using JavaScript, TypeScript, React, Node.js. Led team of 3 developers.',
            startDate: '2020-01-01',
            endDate: '2023-12-31',
          },
          {
            company: 'StartUp Inc',
            position: 'Frontend Developer',
            description:
              'Built responsive React applications with TypeScript. Implemented unit tests and CI/CD pipelines.',
            startDate: '2018-06-01',
            endDate: '2019-12-31',
          },
        ],
        summary:
          'Experienced full-stack developer with 5+ years in JavaScript ecosystem',
      },
    };
  }
}
