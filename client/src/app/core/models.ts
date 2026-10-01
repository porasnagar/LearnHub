// Mirrors the C# DTOs in src/LearnHub.Web/Api/Dtos.cs (JSON is camelCase).

export type Role = 'Student' | 'Instructor' | 'Admin';

export interface User { id: number; fullName: string; email: string; role: Role; createdAt: string; }
export interface Person { id: number; fullName: string; email: string; }
export interface Profile { user: User; courseCount: number; submissionCount: number; }

export interface SubjectCount { name: string; count: number; }

export interface CourseCard {
  id: number; code: string; title: string; description: string; category: string; credits: number;
  isPublished: boolean; instructorName: string; studentCount: number; assignmentCount: number;
  isEnrolled: boolean; mySubmitted: number; toGrade: number;
}

export interface Catalog { totalPublished: number; subjects: SubjectCount[]; courses: CourseCard[]; }

export interface CourseDetail {
  id: number; code: string; title: string; description: string; category: string; credits: number;
  isPublished: boolean; createdAt: string; instructor: Person; studentCount: number; assignmentCount: number;
  isStudent: boolean; isEnrolled: boolean; canManage: boolean;
}

export interface MySubmission { id: number; submittedAt: string; score: number | null; isLate: boolean; hasFeedback: boolean; }

export interface AssignmentRow {
  id: number; courseId: number; title: string; dueDate: string; maxPoints: number;
  submissionCount: number; ungradedCount: number; mySubmission: MySubmission | null;
}

export interface GradebookCell { submissionId: number; score: number | null; isLate: boolean; }
export interface GradebookRow { student: Person; cells: Record<number, GradebookCell>; earned: number; possible: number; }
export interface Gradebook { assignments: AssignmentRow[]; rows: GradebookRow[]; }

export interface RosterRow { student: Person; enrolledAt: string; submitted: number; graded: number; }

export interface CourseForm {
  code: string; title: string; description: string; category: string; credits: number;
  isPublished: boolean; instructorId: number | null;
}

export interface AssignmentForm { courseId: number; title: string; instructions: string; dueDate: string; maxPoints: number; }

export interface Submission {
  id: number; student: Person; textAnswer: string | null; originalFileName: string | null; submittedAt: string;
  score: number | null; feedback: string | null; gradedAt: string | null; isLate: boolean;
}

export interface SubmissionRow { student: Person; submission: Submission | null; stillEnrolled: boolean; }

export interface AssignmentDetail {
  id: number; courseId: number; title: string; instructions: string; dueDate: string; maxPoints: number;
  canManage: boolean; mySubmission: Submission | null; rows: SubmissionRow[];
  allowedExtensions: string; maxFileSizeMB: number;
}

export interface GradeQueueItem { submissionId: number; studentName: string; isGraded: boolean; }
export interface Grading {
  submission: Submission; assignmentId: number; assignmentTitle: string; maxPoints: number; dueDate: string;
  courseId: number; courseCode: string; queue: GradeQueueItem[];
}
export interface GradeResult { nextSubmissionId: number | null; assignmentId: number; }

export interface AssignmentMini {
  id: number; title: string; dueDate: string; maxPoints: number; courseId: number; courseCode: string; courseTitle: string; courseCategory: string; submitted: boolean;
}
export interface Feedback {
  submissionId: number; assignmentId: number; assignmentTitle: string; courseId: number; courseCode: string;
  score: number; maxPoints: number; feedback: string | null; gradedAt: string | null; instructorName: string;
}
export interface Pending {
  submissionId: number; studentName: string; assignmentId: number; assignmentTitle: string;
  courseId: number; courseCode: string; submittedAt: string; isLate: boolean;
}
export interface DayCount { day: string; count: number; }
export interface Completion { assignment: AssignmentMini; submitted: number; enrolled: number; }

export interface Dashboard {
  role: Role; courses: CourseCard[]; activity: DayCount[];
  nextUp: AssignmentMini | null; week: AssignmentMini[]; missing: AssignmentMini[]; recentGrades: Feedback[];
  gradedCount: number; awaitingCount: number; upcomingCount: number; earned: number; possible: number;
  pendingGrading: Pending[]; pendingTotal: number; completion: Completion[]; recentUsers: User[];
  figures: Record<string, number>;
}

export interface CalendarData { courses: { id: number; code: string; title: string }[]; items: AssignmentMini[]; }

export interface CourseGrade {
  courseId: number; code: string; title: string; instructorName: string; assignmentCount: number;
  gradedCount: number; earned: number; possible: number;
}

export interface UserRow { user: User; coursesTaught: number; enrollments: number; }
export interface AdminUsers { counts: Record<string, number>; users: UserRow[]; }

export interface Announcement {
  id: number; courseId: number; courseCode: string; courseTitle: string; title: string; body: string;
  isPinned: boolean; createdAt: string; author: Person; canManage: boolean;
}

export type NotificationKind = 'grade' | 'due' | 'missing' | 'announcement' | 'submission';
export interface AppNotification { key: string; kind: NotificationKind; title: string; detail: string; at: string; link: string; courseId: number | null; }

export interface SearchItem { id: number; title: string; subtitle: string; link: string; courseId: number | null; }
export interface SearchResult { courses: SearchItem[]; assignments: SearchItem[]; people: SearchItem[]; }
