import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import type {
  ClassCompletionItem,
  StatusBreakdownSlice,
} from '../../utils/grading';

interface AdminProgressChartsProps {
  statusSlices: StatusBreakdownSlice[];
  classData: ClassCompletionItem[];
  totalTasks: number;
  overallPercentage: number;
}

export function AdminProgressCharts({
  statusSlices,
  classData,
  totalTasks,
  overallPercentage,
}: AdminProgressChartsProps) {
  const nonZeroSlices = statusSlices.filter((s) => s.value > 0);
  const chartSlices =
    nonZeroSlices.length > 0
      ? nonZeroSlices
      : [{ key: 'empty', name: 'Belum Ada Tugas', value: 1, color: '#E2E8F0' }];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Donut / Ring Progress Chart */}
      <section
        aria-label="Grafik lingkaran progres penyelesaian tugas"
        className="lg:col-span-5 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between gap-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">
              Ringkasan Status Tugas
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Proporsi penyelesaian seluruh tugas penilaian secara real-time.
            </p>
          </div>
          <PieChartIcon className="w-5 h-5 text-emerald-700 shrink-0 mt-1" />
        </div>

        {totalTasks === 0 ? (
          <div className="py-10 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-700">Belum ada tugas penilaian</p>
            <p className="text-xs text-slate-500">
              Petakan tugas ustaz terlebih dahulu untuk melihat grafik lingkaran status.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative h-[190px] w-full min-w-0">
              <ResponsiveContainer width="100%" height={190} minWidth={0}>
                <PieChart>
                  <Pie
                    data={chartSlices}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={56}
                    outerRadius={82}
                    paddingAngle={nonZeroSlices.length > 1 ? 3 : 0}
                    strokeWidth={0}
                    isAnimationActive={false}
                  >
                    {chartSlices.map((slice) => (
                      <Cell key={slice.key} fill={slice.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [`${value} tugas`, 'Jumlah']}
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #E2E8F0',
                      boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
                      fontSize: '13px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="font-display text-2xl font-bold text-emerald-900 tabular-nums">
                  {overallPercentage}%
                </span>
                <span className="text-[11px] font-medium text-slate-500">Selesai</span>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              {statusSlices.map((slice) => {
                const pct =
                  totalTasks > 0 ? Math.round((slice.value / totalTasks) * 100) : 0;
                return (
                  <div
                    key={slice.key}
                    className="flex items-center justify-between gap-3 text-sm py-1.5 border-b border-slate-100 last:border-0"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-3 h-3 rounded-sm shrink-0"
                        style={{ backgroundColor: slice.color }}
                        aria-hidden="true"
                      />
                      <span className="text-slate-700 font-medium">
                        {slice.name}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-slate-900 tabular-nums shrink-0">
                      {slice.value} <span className="text-xs font-normal text-slate-500">({pct}%)</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Bar Chart per Kelas */}
      <section
        aria-label="Grafik batang penyelesaian tugas per kelas"
        className="lg:col-span-7 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between gap-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">
              Grafik Penyelesaian Tugas per Kelas
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Persentase mata pelajaran yang telah dikirim dan dikunci di tiap kelas.
            </p>
          </div>
          <BarChart3 className="w-5 h-5 text-emerald-700 shrink-0 mt-1" />
        </div>

        {classData.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-700">Belum ada kelas terdaftar</p>
            <p className="text-xs text-slate-500">
              Tambahkan kelas pada menu Pemetaan Tugas Ustaz untuk melihat grafik progres per kelas.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="h-[240px] w-full min-w-0">
              <ResponsiveContainer width="100%" height={240} minWidth={0}>
                <BarChart
                  data={classData}
                  margin={{ top: 10, right: 12, left: -12, bottom: 4 }}
                  barCategoryGap="26%"
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#334155', fontSize: 12, fontWeight: 600 }}
                    axisLine={{ stroke: '#CBD5E1' }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fill: '#64748B', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: '#F0F7F4' }}
                    formatter={(value, _name, item) => {
                      const row = item?.payload as ClassCompletionItem | undefined;
                      if (!row) return [`${value}%`, 'Selesai'];
                      return [`${row.done}/${row.total} mapel (${value}%)`, 'Selesai'];
                    }}
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #E2E8F0',
                      boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
                      fontSize: '13px',
                    }}
                  />
                  <Bar
                    dataKey="pct"
                    name="Penyelesaian"
                    radius={[8, 8, 0, 0]}
                    maxBarSize={52}
                    background={{ fill: '#F1F5F9', radius: 8 }}
                    isAnimationActive={false}
                  >
                    {classData.map((entry) => (
                      <Cell
                        key={entry.id}
                        fill={
                          entry.pct === 100
                            ? '#065F46'
                            : entry.pct > 0
                            ? '#059669'
                            : '#CBD5E1'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
              <div className="flex items-center gap-4">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#065F46]" />
                  <span>100% Selesai</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#059669]" />
                  <span>Sebagian Selesai</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#CBD5E1]" />
                  <span>0% (Belum Selesai)</span>
                </span>
              </div>
              <span className="tabular-nums font-medium">
                {classData.length} kelas terpantau real-time
              </span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
