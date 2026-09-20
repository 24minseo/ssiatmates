export type ProgramStatus = "not_started" | "preparing" | "submitted";

export type Schedule = {
  id: string;
  programId: string;
  title: string;
  scheduledAt: string; // ISO string
  completed: boolean;
};

export type Program = {
  id: string;
  title: string;
  organization: string;
  category: string;
  stage: string;
  region: string;
  status: ProgramStatus;
  deadline: string; // ISO string
  createdAt: string; // ISO string
  fitScore: number;
  schedules: Schedule[];
};

export type ProgramInput = {
  title: string;
  organization: string;
  category: string;
  stage: string;
  region: string;
  status: ProgramStatus;
  deadline: string;
};

export type ScheduleInput = {
  title: string;
  scheduledAt: string;
};

const STORAGE_KEY = "ssiat.my-programs.v1";
const LATENCY = 180;

export const PROGRAM_STATUS_LABEL: Record<ProgramStatus, string> = {
  not_started: "시작 전",
  preparing: "준비 중",
  submitted: "제출 완료",
};

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), LATENCY);
  });
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function shift(days: number, hour = 10) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

function seedPrograms(): Program[] {
  const base: Array<
    Omit<Program, "id" | "schedules"> & {
      schedules: Array<Omit<Schedule, "id" | "programId">>;
    }
  > = [
    {
      title: "[제2서울핀테크랩] 서울 핀테크 위크 2026 데모데이 및 글로벌 기술창업 지원 연계 프로그램 참가기업 모집과 사업화 후속 지원 대상자 선정 공고",
      organization: "서울핀테크랩",
      category: "판로·마케팅",
      stage: "초기창업",
      region: "서울",
      status: "not_started",
      deadline: shift(7),
      createdAt: shift(-2),
      fitScore: 92,
      schedules: [],
    },
    {
      title: "2026년 초기창업패키지 예비창업자 모집 공고",
      organization: "창업진흥원",
      category: "사업화",
      stage: "예비창업",
      region: "전국",
      status: "preparing",
      deadline: shift(4),
      createdAt: shift(-6),
      fitScore: 88,
      schedules: [
        { title: "면접 사전 자료 조사", scheduledAt: shift(2), completed: false },
        { title: "사업계획서 초안 작성", scheduledAt: shift(5), completed: false },
        { title: "멘토 피드백 반영", scheduledAt: shift(-1), completed: true },
      ],
    },
    {
      title: "청년창업사관학교 15기 입교생 모집",
      organization: "중소벤처기업진흥공단",
      category: "사업화",
      stage: "초기창업",
      region: "경기",
      status: "submitted",
      deadline: shift(-3),
      createdAt: shift(-14),
      fitScore: 74,
      schedules: [
        { title: "결과발표 확인하기", scheduledAt: shift(9), completed: false },
        { title: "서류 제출", scheduledAt: shift(-4), completed: true },
      ],
    },
    {
      title: "지역 특화 농식품 R&D 지원사업",
      organization: "농림축산식품부",
      category: "기술개발",
      stage: "도약기",
      region: "전북",
      status: "preparing",
      deadline: shift(1),
      createdAt: shift(-1),
      fitScore: 81,
      schedules: [
        { title: "제출 서류 최종 점검", scheduledAt: shift(1, 9), completed: false },
      ],
    },
    {
      title: "스마트 제조 혁신 바우처 지원사업",
      organization: "스마트제조혁신추진단",
      category: "시설·공간",
      stage: "도약기",
      region: "대전",
      status: "not_started",
      deadline: shift(21),
      createdAt: shift(-9),
      fitScore: 63,
      schedules: [],
    },
    {
      title: "소셜벤처 임팩트 투자 연계 프로그램",
      organization: "한국사회적기업진흥원",
      category: "투자·융자",
      stage: "초기창업",
      region: "서울",
      status: "submitted",
      deadline: shift(-12),
      createdAt: shift(-30),
      fitScore: 57,
      schedules: [
        { title: "IR 자료 보완", scheduledAt: shift(-10), completed: true },
      ],
    },
  ];

  return base.map((program) => {
    const id = uid("prg");
    return {
      ...program,
      id,
      schedules: program.schedules.map((schedule) => ({
        ...schedule,
        id: uid("sch"),
        programId: id,
      })),
    };
  });
}

function read(): Program[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = seedPrograms();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as Program[];
    if (!Array.isArray(parsed)) throw new Error("invalid");
    const migrated = parsed.map((program) =>
      (program.title === "[제2서울핀테크랩] 서울 핀테크 위크 2026 데모데이 with 네이버클라우드" ||\n        program.title === "[제2서울핀테크랩] 서울 핀테크 위크 2026 데모데이 및 글로벌 기술창업 지원 연계 프로그램 참가기업 모집 공고")
        ? {
            ...program,
            title: "[제2서울핀테크랩] 서울 핀테크 위크 2026 데모데이 및 글로벌 기술창업 지원 연계 프로그램 참가기업 모집과 사업화 후속 지원 대상자 선정 공고",
          }
        : program,
    );
    if (migrated.some((program, index) => program !== parsed[index])) {
      write(migrated);
    }
    return migrated;
  } catch {
    const seeded = seedPrograms();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

function write(programs: Program[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(programs));
}

export const programService = {
  async list(): Promise<Program[]> {
    return delay(read());
  },

  async create(input: ProgramInput): Promise<Program> {
    const programs = read();
    const program: Program = {
      ...input,
      id: uid("prg"),
      createdAt: new Date().toISOString(),
      fitScore: Math.floor(Math.random() * 40) + 60,
      schedules: [],
    };
    write([program, ...programs]);
    return delay(program);
  },

  async update(id: string, input: ProgramInput): Promise<Program> {
    const programs = read();
    const next = programs.map((program) =>
      program.id === id ? { ...program, ...input } : program,
    );
    write(next);
    const updated = next.find((program) => program.id === id);
    if (!updated) throw new Error("지원사업을 찾을 수 없습니다.");
    return delay(updated);
  },

  async updateStatus(id: string, status: ProgramStatus): Promise<Program> {
    const programs = read();
    const next = programs.map((program) =>
      program.id === id ? { ...program, status } : program,
    );
    write(next);
    const updated = next.find((program) => program.id === id);
    if (!updated) throw new Error("지원사업을 찾을 수 없습니다.");
    return delay(updated);
  },

  async remove(id: string): Promise<void> {
    write(read().filter((program) => program.id !== id));
    return delay(undefined);
  },

  async addSchedule(programId: string, input: ScheduleInput): Promise<Program> {
    const programs = read();
    const next = programs.map((program) =>
      program.id === programId
        ? {
            ...program,
            status:
              program.status === "not_started" && program.schedules.length === 0
                ? "preparing"
                : program.status,
            schedules: [
              ...program.schedules,
              { ...input, id: uid("sch"), programId, completed: false },
            ],
          }
        : program,
    );
    write(next);
    const updated = next.find((program) => program.id === programId);
    if (!updated) throw new Error("지원사업을 찾을 수 없습니다.");
    return delay(updated);
  },

  async toggleSchedule(programId: string, scheduleId: string): Promise<Program> {
    const programs = read();
    const next = programs.map((program) =>
      program.id === programId
        ? {
            ...program,
            schedules: program.schedules.map((schedule) =>
              schedule.id === scheduleId
                ? { ...schedule, completed: !schedule.completed }
                : schedule,
            ),
          }
        : program,
    );
    write(next);
    const updated = next.find((program) => program.id === programId);
    if (!updated) throw new Error("지원사업을 찾을 수 없습니다.");
    return delay(updated);
  },

  async removeSchedule(programId: string, scheduleId: string): Promise<Program> {
    const programs = read();
    const next = programs.map((program) =>
      program.id === programId
        ? {
            ...program,
            schedules: program.schedules.filter(
              (schedule) => schedule.id !== scheduleId,
            ),
          }
        : program,
    );
    write(next);
    const updated = next.find((program) => program.id === programId);
    if (!updated) throw new Error("지원사업을 찾을 수 없습니다.");
    return delay(updated);
  },
};
