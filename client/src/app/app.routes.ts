import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/services';
import { ShellComponent } from './layout/shell.component';

const page = {
  landing: () => import('./pages/landing.component').then(m => m.LandingComponent),
  login: () => import('./pages/auth.component').then(m => m.LoginComponent),
  register: () => import('./pages/auth.component').then(m => m.RegisterComponent),
  dashboard: () => import('./pages/dashboard.component').then(m => m.DashboardComponent),
  catalog: () => import('./pages/catalog.component').then(m => m.CatalogComponent),
  myCourses: () => import('./pages/my-courses.component').then(m => m.MyCoursesComponent),
  courseForm: () => import('./pages/course-form.component').then(m => m.CourseFormComponent),
  calendar: () => import('./pages/calendar.component').then(m => m.CalendarComponent),
  grades: () => import('./pages/grades.component').then(m => m.GradesComponent),
  grading: () => import('./pages/grading.component').then(m => m.GradingComponent),
  admin: () => import('./pages/admin.component').then(m => m.AdminComponent),
  profile: () => import('./pages/profile.component').then(m => m.ProfileComponent),
  notFound: () => import('./pages/not-found.component').then(m => m.NotFoundComponent),
};

export const routes: Routes = [
  { path: '', pathMatch: 'full', canActivate: [guestGuard], loadComponent: page.landing, title: 'LearnHub — learning, organised' },
  { path: 'login', canActivate: [guestGuard], loadComponent: page.login, title: 'Sign in · LearnHub' },
  { path: 'register', canActivate: [guestGuard], loadComponent: page.register, title: 'Create account · LearnHub' },
  {
    path: '',
    component: ShellComponent,
    children: [
      { path: 'catalog', loadComponent: page.catalog, title: 'Catalog · LearnHub' },
      { path: 'dashboard', canActivate: [authGuard], loadComponent: page.dashboard, title: 'Dashboard · LearnHub' },
      { path: 'courses', canActivate: [authGuard], loadComponent: page.myCourses, title: 'My courses · LearnHub' },
      { path: 'courses/new', canActivate: [roleGuard('Instructor', 'Admin')], loadComponent: page.courseForm, title: 'New course · LearnHub' },
      // Course home is public (catalog preview); the other course tabs require access.
      { path: 'courses/:id', loadChildren: () => import('./pages/course/course.routes').then(m => m.courseRoutes) },
      { path: 'grade/:submissionId', canActivate: [roleGuard('Instructor', 'Admin')], loadComponent: page.grading, title: 'Grading · LearnHub' },
      { path: 'calendar', canActivate: [authGuard], loadComponent: page.calendar, title: 'Calendar · LearnHub' },
      { path: 'grades', canActivate: [roleGuard('Student')], loadComponent: page.grades, title: 'Grades · LearnHub' },
      { path: 'admin', canActivate: [roleGuard('Admin')], loadComponent: page.admin, title: 'Administration · LearnHub' },
      { path: 'profile', canActivate: [authGuard], loadComponent: page.profile, title: 'Account · LearnHub' },
      { path: '**', loadComponent: page.notFound, title: 'Not found · LearnHub' },
    ]
  }
];
