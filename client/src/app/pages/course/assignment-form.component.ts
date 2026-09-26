import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { Api } from '../../core/api.service';
import { Toasts } from '../../core/services';
import { toLocalInput } from '../../core/util';
import { IconComponent } from '../../shared/icon.component';
import { CourseStore } from './course.routes';

@Component({
  selector: 'lh-assignment-form',
  imports: [FormsModule, RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="card card-lg form fade-in" (ngSubmit)="save()" #f="ngForm">
      <div class="row between">
        <h2 class="serif h">{{ aid() ? 'Edit assignment' : 'New assignment' }}</h2>
        <a [routerLink]="aid() ? '..' : '../'" class="btn btn-ghost btn-sm"><lh-icon name="x" class="sm" /> Cancel</a>
      </div>
      <div class="field"><label for="t">Title</label><input id="t" class="input" name="title" [(ngModel)]="title" required maxlength="150" placeholder="e.g. Build a Student Directory" /></div>
      <div class="field"><label for="i">Instructions</label>
        <textarea id="i" class="textarea" rows="9" name="instructions" [(ngModel)]="instructions" required maxlength="4000" placeholder="What should students do, and how will it be marked?"></textarea></div>
      <div class="form-grid">
        <div class="field"><label for="d">Due date</label><input id="d" class="input" type="datetime-local" name="due" [(ngModel)]="due" required /></div>
        <div class="field"><label for="p">Points possible</label><input id="p" class="input" type="number" name="points" [(ngModel)]="points" required min="1" max="1000" /></div>
      </div>
      <div class="quick">
        <span class="tiny muted strong">Quick due date:</span>
        @for (q of quick; track q.days) { <button type="button" class="chip" (click)="setDue(q.days)">{{ q.label }}</button> }
      </div>
      <div class="row" style="justify-content:flex-end">
        <button class="btn btn-ink" type="submit" [disabled]="f.invalid || busy()">{{ aid() ? 'Save changes' : 'Publish assignment' }} <lh-icon name="arrow-right" class="sm" /></button>
      </div>
    </form>`,
  styles: [`
    .form { display: flex; flex-direction: column; gap: 1.1rem; max-width: 860px; }
    .h { font-size: 1.6rem; }
    .quick { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; }
  `]
})
export class AssignmentFormComponent {
  private store = inject(CourseStore);
  private api = inject(Api);
  private router = inject(Router);
  private toasts = inject(Toasts);
  readonly aid = input<string>();
  protected busy = signal(false);
  protected title = '';
  protected instructions = '';
  protected points = 100;
  protected due = '';
  protected quick = [{ label: 'Tomorrow', days: 1 }, { label: 'In 1 week', days: 7 }, { label: 'In 2 weeks', days: 14 }];

  constructor() {
    this.setDue(7);
    effect(() => {
      const id = this.aid();
      if (id) this.api.assignment(+id).subscribe(a => {
        this.title = a.title; this.instructions = a.instructions; this.points = a.maxPoints; this.due = a.dueDate.slice(0, 16);
      });
    });
  }

  setDue(days: number) { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(23, 59, 0, 0); this.due = toLocalInput(d); }

  save() {
    const courseId = this.store.course()!.id;
    const form = { courseId, title: this.title, instructions: this.instructions, dueDate: this.due, maxPoints: this.points };
    this.busy.set(true);
    const id = this.aid();
    const req: Observable<number | void> = id ? this.api.updateAssignment(+id, form) : this.api.createAssignment(form);
    req.subscribe({
      next: (res: number | void) => {
        this.toasts.ok(id ? 'Assignment updated.' : 'Assignment published to enrolled students.');
        this.store.reload();
        this.router.navigate(['/courses', courseId, 'assignments', id ? +id : res]);
      },
      error: () => this.busy.set(false)
    });
  }
}
