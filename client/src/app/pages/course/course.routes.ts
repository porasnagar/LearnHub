import { Injectable, computed, inject, signal } from '@angular/core';
import { Routes } from '@angular/router';
import { Api } from '../../core/api.service';
import { CourseDetail } from '../../core/models';
import { authGuard, roleGuard } from '../../core/services';

/** The current course, shared by the course shell and its tabs (provided per course page). */
@Injectable()
export class CourseStore {
  private api = inject(Api);
  readonly course = signal<CourseDetail | null>(null);
  readonly notFound = signal(false);
  readonly canSeeContent = computed(() => !!this.course() && (this.course()!.canManage || this.course()!.isEnrolled));

  load(id: number) {
    this.notFound.set(false);
    this.api.course(id).subscribe({
      next: c => this.course.set(c),
      error: () => this.notFound.set(true)
    });
  }
  reload() { const c = this.course(); if (c) this.load(c.id); }
}

export const courseRoutes: Routes = [
  {
    path: '',
    title: 'Course · LearnHub',
    providers: [CourseStore],
    loadComponent: () => import('./course-shell.component').then(m => m.CourseShellComponent),
    children: [
      { path: '', loadComponent: () => import('./course-home.component').then(m => m.CourseHomeComponent) },
      { path: 'assignments', canActivate: [authGuard], loadComponent: () => import('./course-assignments.component').then(m => m.CourseAssignmentsComponent) },
      { path: 'assignments/new', canActivate: [roleGuard('Instructor', 'Admin')], loadComponent: () => import('./assignment-form.component').then(m => m.AssignmentFormComponent) },
      { path: 'assignments/:aid', canActivate: [authGuard], loadComponent: () => import('./assignment.component').then(m => m.AssignmentComponent) },
      { path: 'assignments/:aid/edit', canActivate: [roleGuard('Instructor', 'Admin')], loadComponent: () => import('./assignment-form.component').then(m => m.AssignmentFormComponent) },
      { path: 'grades', canActivate: [authGuard], loadComponent: () => import('./course-grades.component').then(m => m.CourseGradesComponent) },
      { path: 'people', canActivate: [roleGuard('Instructor', 'Admin')], loadComponent: () => import('./course-people.component').then(m => m.CoursePeopleComponent) },
      { path: 'settings', canActivate: [roleGuard('Instructor', 'Admin')], loadComponent: () => import('./course-settings.component').then(m => m.CourseSettingsComponent) },
    ]
  }
];
