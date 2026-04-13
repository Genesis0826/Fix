import { Test, TestingModule } from '@nestjs/testing';
import { TimekeepingService } from './timekeeping.service';

describe('TimekeepingService', () => {
  let service: TimekeepingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: TimekeepingService,
          useValue: {
            timeIn: jest.fn(),
            timeOut: jest.fn(),
            getMyStatus: jest.fn(),
            getMyTimesheet: jest.fn(),
            getAllTimesheets: jest.fn(),
            getEmployeeDetail: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TimekeepingService>(TimekeepingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
