import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal, effect } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { Api } from '../core/api.service';
import { CourseCard, CourseForm } from '../core/models';
import { Auth, Toasts } from '../core/services';
import { IconComponent } from '../shared/icon.component';
import { CourseCardComponent } from '../shared/ui';

/** Course details form with a live preview card; used by "New course" and course Settings. */
@Component({
  selector: 'lh-course-editor',
  imports: [FormsModule, CourseCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="editor" (ngSubmit)="save.emit(model)" #f="ngForm" (input)="bump()" (change)="bump()">
      <section class="card card-lg fields">
        <div class="form-grid">
          <div class="field"><label for="code">Course code</label>
            <input id="code" class="input upper" name="code" [(ngModel)]="model.code" required maxlength="20" pattern="[A-Za-z0-9\\-]+" placeholder="CS301" /></div>
          <div class="field"><label for="credits">Credits</label>
            <input id="credits" class="input" type="number" name="credits" [(ngModel)]="model.credits" required min="1" max="10" /></div>
        </div>
        <div class="field"><label for="title">Title</label>
          <input id="title" class="input" name="title" [(ngModel)]="model.title" required maxlength="150" placeholder="e.g. ASP.NET Core MVC Fundamentals" /></div>
        <div class="field"><label for="cat">Subject</label>
          <input id="cat" class="input" name="category" [(ngModel)]="model.category" required maxlength="50" list="cats" placeholder="e.g. Web Development" />
          <datalist id="cats">@for (c of categories() ?? []; track c) { <option [value]="c"></option> }</datalist>
          <span class="hint">The subject also chooses the course illustration.</span></div>
        <div class="field"><label for="desc">Description / syllabus</label>
          <textarea id="desc" class="textarea" rows="7" name="description" [(ngModel)]="model.description" required maxlength="4000"
            placeholder="What students will learn and how they'll be assessed"></textarea>
          <span class="hint">{{ model.description.length }} / 4000</span></div>
        @if (auth.isAdmin()) {
          <div class="field"><label for="ins">Instructor</label>
            <select id="ins" class="select" name="instructorId" [(ngModel)]="model.instructorId" required>
              <option [ngValue]="null" disabled>Choose an instructor</option>
              @for (i of instructors() ?? []; track i.id) { <option [ngValue]="i.id">{{ i.fullName }}</option> }
            </select></div>
        }
        <label class="switch"><input type="checkbox" name="pub" [(ngModel)]="model.isPublished" /> Published — visible in the catalog and open for enrollment</label>
        <div class="row" style="justify-content:flex-end">
          <ng-content />
          <button class="btn btn-ink" type="submit" [disabled]="f.invalid || busy()">{{ busy() ? 'Saving…' : submitLabel() }}</button>
        </div>
      </section>
      <aside class="preview">
        <div class="tiny strong muted upper mb-2">Live preview</div>
        <lh-course-card [c]="preview()" />
      </aside>
    </form>`,
  styles: [`
    .editor { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 1.25rem; align-items: start; }
    .fields { display: flex; flex-direction: column; gap: 1.1rem; }
    .upper { text-transform: uppercase; }
    .preview { position: sticky; top: 90px; }
    .preview .upper { text-transform: uppercase; letter-spacing: .08em; }
    @media (max-width: 960px) { .editor { grid-template-columns: 1fr; } .preview { position: static; } }
  `]
})
export class CourseEditorComponent {
  protected auth = inject(Auth);
  private api = inject(Api);
  readonly initial = input<CourseForm | null>(null);
  readonly previewId = input(1);
  readonly submitLabel = input('Save');
  readonly busy = input(false);
  readonly save = output<CourseForm>();

  protected model: CourseForm = { code: '', title: '', description: '', category: '', credits: 3, isPublished: true, instructorId: null };
  private tick = signal(0);
  protected categories = toSignal(this.api.categories());
  protected instructors = toSignal(this.auth.isAdmin() ? this.api.instructors() : of([]));

  constructor() {
    effect(() => { const i = this.initial(); if (i) { this.model = { ...i }; this.bump(); } });
  }

  /** Template-driven form fields aren't signals, so input events re-run the preview. */
  protected bump() { this.tick.update(n => n + 1); }

  protected preview = computed<CourseCard>(() => {
    this.tick();
    const m = this.model;
    return {
      id: this.previewId(), code: m.code.toUpperCase() || 'CODE', title: m.title || 'Course title', description: m.description,
      category: m.category || 'Subject', credits: m.credits || 0, isPublished: m.isPublished, instructorName: this.auth.user()?.fullName ?? '',
      studentCount: 0, assignmentCount: 0, isEnrolled: false, mySubmitted: 0, toGrade: 0
    };
  });
}

@Component({
  selector: 'lh-course-form',
  imports: [RouterLink, CourseEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head fade-in">
        <div><nav class="crumbs"><a routerLink="/courses">My courses</a><span>/</span><span>New course</span></nav>
          <h1 class="page-title">Create a course</h1><p class="page-sub">You can change any of this later in the course settings.</p></div>
      </div>
      <lh-course-editor submitLabel="Create course" [busy]="busy()" [previewId]="3" (save)="create($event)">
        <a routerLink="/courses" class="btn btn-ghost">Cancel</a>
      </lh-course-editor>
    </div>`
})
export class CourseFormComponent {
  private api = inject(Api);
  private router = inject(Router);
  private toasts = inject(Toasts);
  protected busy = signal(false);

  create(form: CourseForm) {
    this.busy.set(true);
    this.api.createCourse(form).subscribe({
      next: c => { this.toasts.ok(`${c.code} created. Add its first assignment next.`); this.router.navigate(['/courses', c.id]); },
      error: () => this.busy.set(false)
    });
  }
}
