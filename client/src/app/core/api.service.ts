import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AdminUsers, Announcement, AppNotification, AssignmentDetail, AssignmentForm, AssignmentRow, CalendarData, Catalog, CourseCard, CourseDetail,
  CourseForm, CourseGrade, Dashboard, Gradebook, GradeResult, Grading, Person, Profile, Role, RosterRow, SearchResult, User
} from './models';

/** Typed wrapper over the ASP.NET Core API (/api/*). */
@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);

  // Auth
  me() { return this.http.get<User | null>('/api/auth/me'); }
  login(email: string, password: string, rememberMe: boolean) { return this.http.post<User>('/api/auth/login', { email, password, rememberMe }); }
  register(body: { fullName: string; email: string; password: string; role: Role }) { return this.http.post<User>('/api/auth/register', body); }
  logout() { return this.http.post<void>('/api/auth/logout', {}); }
  profile() { return this.http.get<Profile>('/api/auth/profile'); }
  changePassword(currentPassword: string, newPassword: string) { return this.http.post<void>('/api/auth/password', { currentPassword, newPassword }); }
  updateProfile(fullName: string) { return this.http.put<User>('/api/auth/profile', { fullName }); }

  // Courses
  catalog(q?: string | null, category?: string | null): Observable<Catalog> {
    let params = new HttpParams();
    if (q) params = params.set('q', q);
    if (category) params = params.set('category', category);
    return this.http.get<Catalog>('/api/courses/catalog', { params });
  }
  myCourses() { return this.http.get<CourseCard[]>('/api/courses/mine'); }
  categories() { return this.http.get<string[]>('/api/courses/categories'); }
  course(id: number) { return this.http.get<CourseDetail>(`/api/courses/${id}`); }
  courseAssignments(id: number) { return this.http.get<AssignmentRow[]>(`/api/courses/${id}/assignments`); }
  gradebook(id: number) { return this.http.get<Gradebook>(`/api/courses/${id}/gradebook`); }
  roster(id: number) { return this.http.get<RosterRow[]>(`/api/courses/${id}/roster`); }
  createCourse(form: CourseForm) { return this.http.post<CourseDetail>('/api/courses', form); }
  updateCourse(id: number, form: CourseForm) { return this.http.put<CourseDetail>(`/api/courses/${id}`, form); }
  deleteCourse(id: number) { return this.http.delete<void>(`/api/courses/${id}`); }
  enroll(id: number) { return this.http.post<void>(`/api/courses/${id}/enroll`, {}); }
  unenroll(id: number) { return this.http.delete<void>(`/api/courses/${id}/enroll`); }
  removeStudent(id: number, studentId: number) { return this.http.delete<void>(`/api/courses/${id}/students/${studentId}`); }

  // Assignments & grading
  assignment(id: number) { return this.http.get<AssignmentDetail>(`/api/assignments/${id}`); }
  createAssignment(form: AssignmentForm) { return this.http.post<number>('/api/assignments', form); }
  updateAssignment(id: number, form: AssignmentForm) { return this.http.put<void>(`/api/assignments/${id}`, form); }
  deleteAssignment(id: number) { return this.http.delete<void>(`/api/assignments/${id}`); }
  submit(id: number, textAnswer: string, file: File | null) {
    const body = new FormData();
    body.append('textAnswer', textAnswer);
    if (file) body.append('attachment', file);
    return this.http.post<void>(`/api/assignments/${id}/submit`, body);
  }
  grading(submissionId: number) { return this.http.get<Grading>(`/api/submissions/${submissionId}`); }
  grade(submissionId: number, score: number, feedback: string) {
    return this.http.post<GradeResult>(`/api/submissions/${submissionId}/grade`, { score, feedback });
  }

  // Dashboard, calendar, grades, admin
  dashboard() { return this.http.get<Dashboard>('/api/dashboard'); }
  calendar(from: string, to: string) { return this.http.get<CalendarData>('/api/calendar', { params: { from, to } }); }
  grades() { return this.http.get<CourseGrade[]>('/api/grades'); }
  adminUsers(q?: string, role?: string) {
    let params = new HttpParams();
    if (q) params = params.set('q', q);
    if (role) params = params.set('role', role);
    return this.http.get<AdminUsers>('/api/admin/users', { params });
  }
  instructors() { return this.http.get<Person[]>('/api/admin/instructors'); }
  changeRole(id: number, role: Role) { return this.http.post<void>(`/api/admin/users/${id}/role`, { role }); }
  deleteUser(id: number) { return this.http.delete<void>(`/api/admin/users/${id}`); }

  // Announcements, notifications, search
  announcements(courseId: number) { return this.http.get<Announcement[]>(`/api/courses/${courseId}/announcements`); }
  announcementFeed(take = 5) { return this.http.get<Announcement[]>('/api/announcements/feed', { params: { take } }); }
  postAnnouncement(courseId: number, body: { title: string; body: string; isPinned: boolean }) {
    return this.http.post<Announcement>(`/api/courses/${courseId}/announcements`, body);
  }
  pinAnnouncement(id: number, isPinned: boolean) { return this.http.put<void>(`/api/announcements/${id}/pin`, { isPinned }); }
  deleteAnnouncement(id: number) { return this.http.delete<void>(`/api/announcements/${id}`); }
  notifications() { return this.http.get<AppNotification[]>('/api/notifications'); }
  search(q: string) { return this.http.get<SearchResult>('/api/search', { params: { q } }); }
}
