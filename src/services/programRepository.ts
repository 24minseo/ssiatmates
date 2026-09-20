export {
  programService as programRepository,
  type Program,
  type ProgramInput,
  type ProgramStatus,
  type ScheduleInput,
} from "./mockProgramService";

/**
 * Data access boundary for saved support programs.
 *
 * The UI imports this repository instead of the mock implementation directly.
 * When Supabase is ready, add a Supabase-backed implementation with the same
 * methods and switch this export without changing the page components.
 */
