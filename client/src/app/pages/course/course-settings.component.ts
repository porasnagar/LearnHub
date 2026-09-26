import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Api } from '../../core/api.service';
import { CourseForm } from '../../core/models';
import { Confirm, Toasts } from '../../core/services';
import { IconComponent } from '../../shared/icon.component';
import { CourseEditorComponent } from '../course-form.component';
import { CourseStore } from './course.routes';

@Component({
  selector: 'lh-course-settings',
  imports: [CourseEditorComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.course(); as c) {
      <div class="stack fade-in">
        <lh-course-editor [initial]="initial()" [previewId]="c.id" submitLabel="Save settings" [busy]="busy()" (save)="save($event)" />
        <section class="card card-lg danger">
          <div class="row wrap between">
            <div class="row"><span class="ic"><lh-icon name="alert" /></span>
              <div><div class="card-title">Delete this course</div><p class="small muted">Removes its enrollments, assignments, submissions and grades. To hide it for now, unpublish it instead.</p></div></div>
            <button class="btn btn-danger" (click)="remove()"><lh-icon name="trash" class="sm" /> Delete course</button>
          </div>
        </section>
      </div>
    }`,
  styles: [`
    .danger { border-color: color-mix(in srgb, var(--bad) 30%, transparent); }
    .ic { width: 44px; height: 44px; border-radius: 14px; background: var(--bad-soft); color: var(--bad); display: grid; place-items: center; flex-shrink: 0; }
  `]
})
export class CourseSettingsComponent {
  protected store = inject(CourseStore);
  private api = inject(Api);
  private router = inject(Router);
  private toasts = inject(Toasts);
  private confirm = inject(Confirm);
  protected busy = signal(false);

  protected initial = computed<CourseForm | null>(() => {
    const c = this.store.course();
    return c && { code: c.code, title: c.title, description: c.description, category: c.category, credits: c.credits, isPublished: c.isPublished, instructorId: c.instructor.id };
  });

  save(form: CourseForm) {
    this.busy.set(true);
    this.api.updateCourse(this.store.course()!.id, form).subscribe({
      next: c => { this.store.course.set(c); this.toasts.ok('Course settings saved.'); this.busy.set(false); },
      error: () => this.busy.set(false)
    });
  }

  async remove() {
    const c = this.store.course()!;
    if (!await this.confirm.ask(`Delete ${c.code}?`, `"${c.title}" and all of its coursework will be permanently deleted. This can't be undone.`, 'Delete permanently')) return;
    this.api.deleteCourse(c.id).subscribe(() => { this.toasts.ok(`${c.code} deleted.`); this.router.navigateByUrl('/courses'); });
  }
}
