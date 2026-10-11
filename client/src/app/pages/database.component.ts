import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { Api } from '../core/api.service';
import { DbColumn } from '../core/models';
import { IconComponent } from '../shared/icon.component';
import { CountUpDirective, GlideDirective } from '../shared/motion';
import { EmptyComponent } from '../shared/ui';

type View = 'rows' | 'structure' | 'sql';
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/**
 * Admin-only, read-only window into the live database: every table with its row count,
 * its columns and keys as Entity Framework Core maps them, its rows page by page,
 * and the whole schema as SQL. Password hashes arrive masked from the server.
 */
@Component({
  selector: 'lh-database',
  imports: [DatePipe, DecimalPipe, RouterLink, IconComponent, EmptyComponent, GlideDirective, CountUpDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <p class="crumbs"><a routerLink="/admin">Administration</a> / Database</p>
          <h1 class="page-title">Database</h1>
          <p class="page-sub">A live, read-only view of the data behind LearnHub: every table, column, key and row, as Entity Framework Core maps them.</p>
        </div>
        <a class="btn btn-glass" href="/api/admin/database/schema.sql" download="learnhub-schema.sql"><lh-icon name="download" class="sm" /> Schema SQL</a>
      </div>

      @if (overview.value(); as o) {
        <div class="facts">
          <div class="fact"><span class="n serif" [lhCountUp]="o.tables.length"></span><span class="tiny muted">tables</span></div>
          <div class="fact"><span class="n serif" [lhCountUp]="o.totalRows"></span><span class="tiny muted">rows in total</span></div>
          <div class="fact"><span class="n serif">{{ o.provider }}</span><span class="tiny muted">database engine</span></div>
          @if (o.sizeBytes !== null) {
            <div class="fact"><span class="n serif">{{ o.sizeBytes / 1024 | number: '1.0-0' }} KB</span><span class="tiny muted">file size</span></div>
          }
        </div>

        <div class="layout">
          <aside class="card card-flush tables-card">
            <div class="list-head small strong muted">Tables</div>
            <div class="tables" lhGlide role="tablist" aria-label="Tables">
              @for (t of o.tables; track t.name) {
                <button type="button" role="tab" class="tbl" [class.active]="t.name === current()" [attr.aria-selected]="t.name === current()" (click)="pick(t.name)">
                  <lh-icon name="database" class="sm" />
                  <span class="grow"><span class="t-name">{{ t.name }}</span><span class="t-sub">{{ t.columns.length }} columns · {{ t.entity }}</span></span>
                  <span class="t-count tabnum">{{ t.rows }}</span>
                </button>
              }
            </div>
          </aside>

          @if (table(); as t) {
            <section class="card card-flush main">
              <div class="main-head">
                <div class="grow">
                  <h2 class="card-title row"><lh-icon name="database" class="sm" /> {{ t.name }}</h2>
                  <p class="card-sub">{{ t.rows }} {{ t.rows === 1 ? 'row' : 'rows' }} · mapped from the <code>{{ t.entity }}</code> class · {{ keyCount(t.columns) }}</p>
                </div>
                <div class="seg" lhGlide role="tablist" aria-label="View">
                  <button role="tab" [class.active]="view() === 'rows'" (click)="view.set('rows')"><lh-icon name="list" class="sm" /> Rows</button>
                  <button role="tab" [class.active]="view() === 'structure'" (click)="view.set('structure')"><lh-icon name="key" class="sm" /> Structure</button>
                  <button role="tab" [class.active]="view() === 'sql'" (click)="view.set('sql')"><lh-icon name="file" class="sm" /> SQL</button>
                </div>
              </div>

              @switch (view()) {
                @case ('rows') {
                  @if (rows.value(); as r) {
                    @if (r.rows.length) {
                      <div class="table-wrap">
                        <table class="table data">
                          <thead><tr>@for (c of r.columns; track c) { <th [class.pk]="isPk(t.columns, c)">{{ c }}</th> }</tr></thead>
                          <tbody>
                            @for (row of r.rows; track $index) {
                              <tr>
                                @for (c of r.columns; track c) {
                                  @let v = row[c];
                                  <td [title]="v ?? 'NULL'">
                                    @if (v === null || v === undefined) { <span class="null">NULL</span> }
                                    @else if (v === true || v === false) { <span class="bool" [class.on]="v">{{ v }}</span> }
                                    @else if (isDate(v)) { <span class="nowrap">{{ asText(v) | date: 'MMM d, y, h:mm a' }}</span> }
                                    @else if (isPk(t.columns, c)) { <span class="strong tabnum">{{ v }}</span> }
                                    @else { <span class="cell">{{ v }}</span> }
                                  </td>
                                }
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                      <div class="pager">
                        <span class="small muted">Rows {{ (r.page - 1) * r.pageSize + 1 }}–{{ (r.page - 1) * r.pageSize + r.rows.length }} of {{ r.total }}</span>
                        <div class="row">
                          <button class="btn btn-ghost btn-sm" (click)="page.set(page() - 1)" [disabled]="r.page <= 1"><lh-icon name="chevron-left" class="sm" /> Previous</button>
                          <span class="small strong tabnum">Page {{ r.page }} of {{ pages(r.total, r.pageSize) }}</span>
                          <button class="btn btn-ghost btn-sm" (click)="page.set(page() + 1)" [disabled]="r.page >= pages(r.total, r.pageSize)">Next <lh-icon name="chevron-right" class="sm" /></button>
                        </div>
                      </div>
                    } @else {
                      <lh-empty icon="database" title="This table is empty" text="Rows appear here as soon as the application writes them." />
                    }
                  } @else { <div class="pad"><div class="skeleton" style="height:260px"></div></div> }
                }
                @case ('structure') {
                  <div class="table-wrap">
                    <table class="table">
                      <thead><tr><th>Column</th><th>SQL type</th><th>C# type</th><th>Null</th><th>Key</th><th>Rules</th></tr></thead>
                      <tbody>
                        @for (c of t.columns; track c.name) {
                          <tr>
                            <td class="strong">{{ c.name }}</td>
                            <td><code>{{ c.storeType }}</code></td>
                            <td class="muted small">{{ c.clrType }}</td>
                            <td>{{ c.nullable ? 'Yes' : 'No' }}</td>
                            <td>
                              @if (c.primaryKey) { <span class="badge pk"><lh-icon name="key" class="sm" /> Primary</span> }
                              @if (c.references) { <span class="badge fk"><lh-icon name="link" class="sm" /> {{ c.references }}</span> }
                            </td>
                            <td class="small muted">
                              @if (c.unique) { <span class="badge">Unique</span> }
                              @if (c.onDelete) { <span>On delete: {{ c.onDelete }}</span> }
                              @if (c.maxLength) { <span>Max {{ c.maxLength }} chars</span> }
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                  @if (t.indexes.length) {
                    <div class="indexes">
                      <span class="small strong">Indexes</span>
                      @for (i of t.indexes; track i) { <code class="idx">{{ i }}</code> }
                    </div>
                  }
                }
                @case ('sql') {
                  @if (schema.value(); as sql) {
                    <pre class="sql"><code>{{ sqlFor(sql, t.name) }}</code></pre>
                    <p class="small muted pad-x">Generated by Entity Framework Core from the model. Download “Schema SQL” for the whole database.</p>
                  } @else { <div class="pad"><div class="skeleton" style="height:200px"></div></div> }
                }
              }
            </section>
          }
        </div>
      } @else if (overview.error()) {
        <div class="card"><lh-empty icon="alert" title="Couldn't load the database" text="Only administrators can open this page." /></div>
      } @else {
        <div class="skeleton" style="height:420px"></div>
      }
    </div>
  `,
  styles: [`
    .facts { display: flex; flex-wrap: wrap; gap: .75rem; }
    .fact { display: flex; flex-direction: column; gap: 2px; padding: .8rem 1.1rem; min-width: 140px; border-radius: var(--r-card);
      background: var(--glass-card); border: 1px solid var(--glass-line); }
    .fact .n { font-size: 1.5rem; font-weight: 600; line-height: 1.1; }
    .layout { display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 1.25rem; align-items: start; }
    .layout > * { min-width: 0; }
    .list-head { padding: .9rem 1rem .4rem; }
    .tables { display: flex; flex-direction: column; gap: 2px; padding: 0 .5rem .6rem; --glide-ease: var(--spring); }
    .tbl { display: flex; align-items: center; gap: .65rem; width: 100%; padding: .6rem .7rem; border: 0; border-radius: var(--r-ctl); background: transparent;
      color: var(--ink-2); text-align: left; cursor: pointer; transition: color 300ms var(--ease-out); }
    .tbl:hover { background: var(--accent-tint); }
    .tbl.active { color: #fff; background: var(--nav-grad); }
    .t-name { display: block; font-weight: 700; }
    .t-sub { display: block; font-size: .76rem; opacity: .75; }
    .t-count { font-weight: 800; font-size: .86rem; }
    .main-head { display: flex; flex-wrap: wrap; align-items: center; gap: .75rem; padding: 1rem 1.1rem .9rem; border-bottom: 1px solid var(--line); }
    .card-sub code, .indexes code { font-size: .8rem; }
    .data th { font-family: ui-monospace, Consolas, monospace; font-size: .76rem; }
    .data th.pk { color: var(--violet); }
    .data td { max-width: 280px; font-size: .86rem; }
    .cell { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .null { font-family: ui-monospace, Consolas, monospace; font-size: .74rem; color: var(--faint); }
    .bool { display: inline-grid; place-items: center; height: 22px; padding: 0 .5rem; border-radius: 999px; font-size: .74rem; font-weight: 700;
      background: var(--surface-2); color: var(--muted); }
    .bool.on { background: var(--ok-soft); color: var(--ok); }
    .pager { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .5rem; padding: .7rem 1rem; border-top: 1px solid var(--line); }
    .badge { display: inline-flex; align-items: center; gap: .3rem; height: 24px; padding: 0 .55rem; margin: 2px 4px 2px 0; border-radius: 8px;
      font-size: .76rem; font-weight: 700; background: var(--surface-2); color: var(--ink-2); white-space: nowrap; }
    .badge.pk { background: var(--violet-soft); color: var(--violet); }
    .badge.fk { background: var(--info-soft); color: var(--info); }
    td.small span + span { margin-left: .5rem; }
    .indexes { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; padding: .8rem 1rem 1rem; border-top: 1px solid var(--line); }
    .idx { padding: .2rem .5rem; border-radius: 6px; background: var(--surface-2); }
    .sql { margin: 1rem; padding: 1rem; border-radius: var(--r-ctl); background: oklch(0.2 0.02 var(--hue)); color: oklch(0.92 0.03 var(--hue));
      font-family: ui-monospace, Consolas, monospace; font-size: .8rem; line-height: 1.6; overflow-x: auto; white-space: pre; }
    .pad { padding: 1rem; } .pad-x { padding: 0 1rem 1rem; }
    @media (max-width: 900px) {
      .layout { grid-template-columns: minmax(0, 1fr); }
      .tables { flex-direction: row; overflow-x: auto; padding-bottom: .7rem; scrollbar-width: none; }
      .tbl { width: auto; flex: 0 0 auto; }
      .t-sub { display: none; }
      .fact { min-width: 0; flex: 1 1 40%; }
    }
  `]
})
export class DatabaseComponent {
  private api = inject(Api);
  protected readonly view = signal<View>('rows');
  protected readonly selected = signal<string | null>(null);
  protected readonly page = signal(1);

  protected overview = rxResource({ loader: () => this.api.dbOverview() });
  protected readonly current = computed(() => this.selected() ?? this.overview.value()?.tables[0]?.name ?? null);
  protected readonly table = computed(() => this.overview.value()?.tables.find(t => t.name === this.current()) ?? null);
  protected rows = rxResource({
    request: () => ({ table: this.current(), page: this.page() }),
    loader: ({ request }) => request.table ? this.api.dbRows(request.table, request.page) : of(null)
  });
  // The schema is fetched once, the first time the SQL tab is opened.
  protected schema = rxResource({
    request: () => this.view() === 'sql' || null,
    loader: ({ request }) => request ? this.api.dbSchema() : of(undefined)
  });

  pick(name: string) {
    this.selected.set(name);
    this.page.set(1);
  }

  protected pages(total: number, size: number) { return Math.max(1, Math.ceil(total / size)); }
  protected isPk(cols: DbColumn[], name: string) { return cols.some(c => c.name === name && c.primaryKey); }
  protected isDate(v: unknown) { return typeof v === 'string' && ISO.test(v); }
  protected asText(v: unknown) { return String(v); }
  protected keyCount(cols: DbColumn[]) {
    const fks = cols.filter(c => c.references).length;
    return `1 primary key${fks ? `, ${fks} foreign key${fks === 1 ? '' : 's'}` : ''}`;
  }

  /** Just this table's CREATE TABLE statement and its indexes, out of the whole script. */
  protected sqlFor(sql: string, table: string) {
    const parts = sql.split(/;\s*\n/).map(s => s.trim()).filter(Boolean);
    const mine = parts.filter(p => new RegExp(`(TABLE|ON) "${table}"`).test(p));
    return (mine.length ? mine : parts).map(p => p + ';').join('\n\n');
  }
}
