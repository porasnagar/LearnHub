import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Api } from '../core/api.service';
import { Announcement } from '../core/models';
import { Confirm, Toasts } from '../core/services';
import { ago } from '../core/util';
import { IconComponent } from './icon.component';
import { AvatarComponent } from './ui';

/**
 * A course's announcements. Instructors (and admins) post, pin and delete;
 * enrolled students read. Pinned posts stay on top.
 */
@Component({
  selector: 'lh-announcements',
  imports: [FormsModule, IconComponent, AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card" aria-labelledby="ann-title">
      <div class="card-head">
        <div>
          <h2 id="ann-title" class="card-title">Announcements</h2>
          <p class="card-sub">{{ list().length ? list().length + (list().length === 1 ? ' post' : ' posts') : 'News from the instructor' }}</p>
        </div>
        @if (canManage() && !composing()) {
          <button type="button" class="btn btn-secondary btn-sm" (click)="startCompose()"><lh-icon name="megaphone" class="sm" /> New post</button>
        }
      </div>

      @if (composing()) {
        <form class="composer" (ngSubmit)="post()" #f="ngForm">
          <input id="ann-new-title" class="input" name="title" [(ngModel)]="title" required maxlength="150" placeholder="Title, e.g. “Quiz moved to Friday”" aria-label="Title" />
          <textarea class="textarea" name="body" [(ngModel)]="body" required maxlength="4000" rows="4" placeholder="Write the details students need…" aria-label="Message"></textarea>
          <div class="row between wrap">
            <label class="switch small"><input type="checkbox" name="pin" [(ngModel)]="pinned" /> Pin to the top</label>
            <div class="row">
              <button type="button" class="btn btn-ghost btn-sm" (click)="composing.set(false)">Cancel</button>
              <button class="btn btn-ink btn-sm" [disabled]="f.invalid || busy()">{{ busy() ? 'Posting…' : 'Post announcement' }}</button>
            </div>
          </div>
        </form>
      }

      @if (data.isLoading() && !list().length) {
        <div class="skeleton" style="height:84px"></div>
      } @else {
        <div class="posts">
          @for (a of list(); track a.id) {
            <article class="post" [class.pinned]="a.isPinned">
              <div class="row-top">
                <lh-avatar [name]="a.author.fullName" size="sm" />
                <div class="grow">
                  <div class="row wrap head">
                    <h3 class="t">{{ a.title }}</h3>
                    @if (a.isPinned) { <span class="pin-tag"><lh-icon name="pin" class="sm" /> Pinned</span> }
                  </div>
                  <div class="tiny muted">{{ a.author.fullName }} · {{ ago(a.createdAt) }}</div>
                  <p class="body pre" [class.clamp]="!open().has(a.id) && a.body.length > 260">{{ a.body }}</p>
                  @if (a.body.length > 260) {
                    <button type="button" class="more" (click)="toggle(a.id)">{{ open().has(a.id) ? 'Show less' : 'Read more' }}</button>
                  }
                </div>
                @if (a.canManage) {
                  <div class="acts">
                    <button type="button" class="btn btn-ghost btn-icon btn-sm" (click)="pin(a)" [attr.aria-label]="a.isPinned ? 'Unpin' : 'Pin to the top'" [title]="a.isPinned ? 'Unpin' : 'Pin to the top'">
                      <lh-icon name="pin" class="sm" />
                    </button>
                    <button type="button" class="btn btn-ghost btn-icon btn-sm" (click)="remove(a)" aria-label="Delete announcement" title="Delete">
                      <lh-icon name="trash" class="sm" />
                    </button>
                  </div>
                }
              </div>
            </article>
          } @empty {
            <div class="empty">
              <lh-icon name="megaphone" />
              <strong>No announcements yet</strong>
              <span class="small">{{ canManage() ? 'Post one to tell every enrolled student at once.' : 'When the instructor posts news, it shows up here.' }}</span>
            </div>
          }
        </div>
      }
    </section>
  `,
  styles: [`
    .composer { display: flex; flex-direction: column; gap: .6rem; padding: .85rem; margin-bottom: .75rem; border-radius: var(--r-ctl);
      background: var(--surface-2); border: 1px solid var(--line); animation: lh-pop 220ms var(--ease-out) backwards; }
    .posts { display: flex; flex-direction: column; }
    .post { padding: .85rem .35rem; animation: lh-enter 320ms var(--ease-out) backwards; }
    .post + .post { border-top: 1px solid var(--line); }
    .post.pinned { background: var(--violet-soft); border-radius: var(--r-ctl); padding: .85rem .7rem; }
    .post.pinned + .post { border-top: 0; }
    .head { gap: .5rem; }
    .t { font-size: 1rem; font-weight: 700; }
    .pin-tag { display: inline-flex; align-items: center; gap: .25rem; font-size: .74rem; font-weight: 700; color: var(--violet); }
    .body { margin-top: .45rem; color: var(--ink-2); line-height: 1.6; overflow-wrap: anywhere; }
    .body.clamp { display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
    .more { margin-top: .25rem; padding: 0; border: 0; background: none; color: var(--violet); font-weight: 700; font-size: .86rem; cursor: pointer; }
    .acts { display: flex; gap: 2px; flex-shrink: 0; }
  `]
})
export class AnnouncementsComponent {
  private api = inject(Api);
  private toasts = inject(Toasts);
  private confirm = inject(Confirm);

  readonly courseId = input.required<number>();
  readonly canManage = input(false);

  protected readonly data = rxResource({ request: () => this.courseId(), loader: ({ request }) => this.api.announcements(request) });
  protected readonly list = computed(() => this.data.value() ?? []);
  protected readonly composing = signal(false);
  protected readonly busy = signal(false);
  protected readonly open = signal<Set<number>>(new Set());
  protected readonly ago = ago;
  protected title = '';
  protected body = '';
  protected pinned = false;

  startCompose() {
    this.title = this.body = '';
    this.pinned = false;
    this.composing.set(true);
    setTimeout(() => document.getElementById('ann-new-title')?.focus());
  }

  post() {
    this.busy.set(true);
    this.api.postAnnouncement(this.courseId(), { title: this.title.trim(), body: this.body.trim(), isPinned: this.pinned }).subscribe({
      next: () => {
        this.busy.set(false);
        this.composing.set(false);
        this.toasts.ok('Announcement posted to every enrolled student.');
        this.data.reload();
      },
      error: () => this.busy.set(false)
    });
  }

  pin(a: Announcement) {
    this.api.pinAnnouncement(a.id, !a.isPinned).subscribe(() => {
      this.toasts.show(a.isPinned ? 'Unpinned.' : 'Pinned to the top.', 'info');
      this.data.reload();
    });
  }

  async remove(a: Announcement) {
    if (!await this.confirm.ask('Delete this announcement?', `“${a.title}” will disappear for every student.`, 'Delete')) return;
    this.api.deleteAnnouncement(a.id).subscribe(() => {
      this.toasts.show('Announcement deleted.', 'info');
      this.data.value.update(list => list?.filter(x => x.id !== a.id));
    });
  }

  toggle(id: number) {
    const next = new Set(this.open());
    next.has(id) ? next.delete(id) : next.add(id);
    this.open.set(next);
  }
}
