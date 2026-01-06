import { ConnectorConfig, DataConnect, OperationOptions, ExecuteOperationResponse } from 'firebase-admin/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;


export interface AddNewStudentData {
  student_insert: Student_Key;
}

export interface AddNewStudentVariables {
  email: string;
  name: string;
  studentID: string;
}

export interface Attendance_Key {
  studentId: UUIDString;
  sessionId: UUIDString;
  __typename?: 'Attendance_Key';
}

export interface Course_Key {
  id: UUIDString;
  __typename?: 'Course_Key';
}

export interface Enrollment_Key {
  studentId: UUIDString;
  courseId: UUIDString;
  __typename?: 'Enrollment_Key';
}

export interface GetCourseByCodeData {
  courses: ({
    id: UUIDString;
    courseCode: string;
    courseName: string;
    description?: string | null;
    instructorName?: string | null;
  } & Course_Key)[];
}

export interface GetCourseByCodeVariables {
  courseCode: string;
}

export interface GetStudentCoursesData {
  students: ({
    courses_via_Enrollment: ({
      id: UUIDString;
      courseCode: string;
      courseName: string;
      instructorName?: string | null;
    } & Course_Key)[];
  })[];
}

export interface RecordAttendanceData {
  attendance_insert: Attendance_Key;
}

export interface RecordAttendanceVariables {
  studentId: UUIDString;
  sessionId: UUIDString;
  attendanceStatus: string;
}

export interface Session_Key {
  id: UUIDString;
  __typename?: 'Session_Key';
}

export interface Student_Key {
  id: UUIDString;
  __typename?: 'Student_Key';
}

/** Generated Node Admin SDK operation action function for the 'AddNewStudent' Mutation. Allow users to execute without passing in DataConnect. */
export function addNewStudent(dc: DataConnect, vars: AddNewStudentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AddNewStudentData>>;
/** Generated Node Admin SDK operation action function for the 'AddNewStudent' Mutation. Allow users to pass in custom DataConnect instances. */
export function addNewStudent(vars: AddNewStudentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AddNewStudentData>>;

/** Generated Node Admin SDK operation action function for the 'GetCourseByCode' Query. Allow users to execute without passing in DataConnect. */
export function getCourseByCode(dc: DataConnect, vars: GetCourseByCodeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetCourseByCodeData>>;
/** Generated Node Admin SDK operation action function for the 'GetCourseByCode' Query. Allow users to pass in custom DataConnect instances. */
export function getCourseByCode(vars: GetCourseByCodeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetCourseByCodeData>>;

/** Generated Node Admin SDK operation action function for the 'RecordAttendance' Mutation. Allow users to execute without passing in DataConnect. */
export function recordAttendance(dc: DataConnect, vars: RecordAttendanceVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordAttendanceData>>;
/** Generated Node Admin SDK operation action function for the 'RecordAttendance' Mutation. Allow users to pass in custom DataConnect instances. */
export function recordAttendance(vars: RecordAttendanceVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<RecordAttendanceData>>;

/** Generated Node Admin SDK operation action function for the 'GetStudentCourses' Query. Allow users to execute without passing in DataConnect. */
export function getStudentCourses(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<GetStudentCoursesData>>;
/** Generated Node Admin SDK operation action function for the 'GetStudentCourses' Query. Allow users to pass in custom DataConnect instances. */
export function getStudentCourses(options?: OperationOptions): Promise<ExecuteOperationResponse<GetStudentCoursesData>>;

