import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  Check,
  ClipboardCheck,
  Clock,
  Copy,
  ExternalLink,
  History,
  Lock,
  MessageCircle,
  Unlock,
  X,
} from 'lucide-react';
import { usePortal } from '../../services/portalContext';
import type { Assignment } from '../../types/portal';
import {
  computeUstazProgress,
  getStatusLabel,
  identifyUstazNeedingReminder,
  type UstazReminderCandidate,
} from '../../utils/grading';
import {
  buildReminderMessageTemplate,
  buildWhatsappReminderUrl,
  type ReminderTone,
} from '../../utils/validation';

export function AdminMonitoringPage() {
  const {
    ustazList,
    classes,
    subjects,
    periods,
    assignments,
    auditLogs,
    unlockAssignment,
    settings,
    notify,
  } = usePortal();

  const [filterUstazId, setFilterUstazId] = useState('all');
  const [filterClassId, setFilterClassId] = useState('all');
  const [filterSubjectId, setFilterSubjectId] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [onlyPendingReminder, setOnlyPendingReminder] = useState(false);

  // WhatsApp editable modal state
  const [waCandidate, setWaCandidate] = useState<UstazReminderCandidate | null>(null);
  const [waTone, setWaTone] = useState<ReminderTone>('ramah');
  const [waMessage, setWaMessage] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Unlock modal state
  const [unlockTarget, setUnlockTarget] = useState<Assignment | null>(null);
  const [unlockReason, setUnlockReason] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  const activePeriod = useMemo(
    () => periods.find((p) => p.id === settings.activePeriodId) || periods.find((p) => p.isActive),
    [periods, settings.activePeriodId]
  );

  const reminderCandidates = useMemo(
    () =>
      identifyUstazNeedingReminder(
        ustazList,
        assignments,
        periods,
        settings.activePeriodId
      ),
    [assignments, periods, settings.activePeriodId, ustazList]
  );

  const urgentReminderSummary = useMemo(() => {
    const pendingList = reminderCandidates.filter((c) => c.needsReminder);
    const urgentList = pendingList.filter(
      (c) => c.urgency.level === 'due_soon' || c.urgency.level === 'overdue'
    );
    return {
      totalPendingUstaz: pendingList.length,
      totalUrgentUstaz: urgentList.length,
      pendingList,
    };
  }, [reminderCandidates]);

  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      if (filterUstazId !== 'all' && a.ustazId !== filterUstazId) return false;
      if (filterClassId !== 'all' && a.classId !== filterClassId) return false;
      if (filterSubjectId !== 'all' && a.subjectId !== filterSubjectId) return false;
      if (filterStatus !== 'all' && a.status !== filterStatus) return false;
      return true;
    });
  }, [assignments, filterClassId, filterStatus, filterSubjectId, filterUstazId]);

  const displayedCandidates = useMemo(() => {
    return reminderCandidates.filter((c) => {
      if (onlyPendingReminder && !c.needsReminder) return false;
      if (filterUstazId !== 'all' && c.ustaz.id !== filterUstazId) return false;
      if (filterClassId !== 'all' || filterSubjectId !== 'all' || filterStatus !== 'all') {
        return filteredAssignments.some((a) => a.ustazId === c.ustaz.id);
      }
      return true;
    });
  }, [
    filterClassId,
    filterStatus,
    filterSubjectId,
    filterUstazId,
    filteredAssignments,
    onlyPendingReminder,
    reminderCandidates,
  ]);

  const generateMessageForCandidate = (
    candidate: UstazReminderCandidate,
    tone: ReminderTone
  ) => {
    return buildReminderMessageTemplate({
      ustazName: candidate.ustaz.name,
      schoolName: settings.schoolName,
      academicYear: settings.academicYear,
      semester: settings.semester,
      completedTasks: candidate.progress.completedTasks,
      totalTasks: candidate.progress.totalTasks,
      pendingAssignments: candidate.pendingAssignments,
      deadlineDate: candidate.nearestEndDate || activePeriod?.endDate,
      deadlineLabel:
        candidate.urgency.level !== 'no_deadline' ? candidate.urgency.label : undefined,
      tone,
    });
  };

  const openWhatsappModal = (candidate: UstazReminderCandidate) => {
    const defaultTone: ReminderTone =
      candidate.urgency.level === 'overdue'
        ? 'mendesak'
        : candidate.urgency.level === 'due_soon'
        ? 'tenggat'
        : 'ramah';

    setWaCandidate(candidate);
    setWaTone(defaultTone);
    setWaMessage(generateMessageForCandidate(candidate, defaultTone));
    setCopiedLink(false);
  };

  const handleToneChange = (tone: ReminderTone) => {
    if (!waCandidate) return;
    setWaTone(tone);
    setWaMessage(generateMessageForCandidate(waCandidate, tone));
    setCopiedLink(false);
  };

  const generatedWaUrl = useMemo(() => {
    if (!waCandidate) return '';
    return buildWhatsappReminderUrl(waCandidate.ustaz.whatsapp, waMessage);
  }, [waCandidate, waMessage]);

  const handleCopyWaLink = async () => {
    if (!generatedWaUrl) return;
    try {
      await navigator.clipboard.writeText(generatedWaUrl);
      setCopiedLink(true);
      notify('success', 'Link WhatsApp Disalin', 'Tautan pesan pengingat siap dibagikan.');
    } catch {
      notify('warning', 'Gagal Menyalin Otomatis', 'Silakan salin tautan secara manual dari kotak di bawah.');
    }
  };

  const handleConfirmUnlock = async () => {
    if (!unlockTarget) return;
    if (unlockReason.trim().length < 3) {
      setUnlockError('Alasan pembukaan tugas wajib diisi (minimal 3 karakter).');
      return;
    }
    setUnlocking(true);
    await unlockAssignment(unlockTarget.id, unlockReason.trim());
    setUnlocking(false);
    setUnlockTarget(null);
    setUnlockReason('');
    setUnlockError('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl sm:text-[30px] font-bold text-slate-900 tracking-tight">
          Monitoring &amp; Pengingat WhatsApp
        </h1>
        <p className="text-sm text-slate-600 mt-0.5">
          Pantau progres pengisian setiap ustaz, buat link pesan WhatsApp otomatis untuk tugas belum selesai atau mendekati tenggat, dan kelola pembukaan kunci tugas.
        </p>
      </div>

      {/* Urgent / Pending WhatsApp Reminder Queue Banner */}
      {ustazList.length > 0 && (
        <section
          aria-label="Antrean pengingat WhatsApp otomatis"
          className={`border rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs ${
            urgentReminderSummary.totalUrgentUstaz > 0
              ? 'bg-amber-50/70 border-amber-300/80'
              : urgentReminderSummary.totalPendingUstaz > 0
              ? 'bg-[#F0F7F4] border-emerald-200'
              : 'bg-white border-slate-200/90'
          }`}
        >
          <div className="flex items-start gap-3.5">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                urgentReminderSummary.totalUrgentUstaz > 0
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-white border border-emerald-200 text-emerald-800'
              }`}
            >
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">
                {urgentReminderSummary.totalPendingUstaz === 0
                  ? 'Seluruh Ustaz Sudah Menyelesaikan Tugas Penilaian'
                  : urgentReminderSummary.totalUrgentUstaz > 0
                  ? `${urgentReminderSummary.totalUrgentUstaz} Ustaz Mendekati / Melewati Tenggat Waktu`
                  : `${urgentReminderSummary.totalPendingUstaz} Ustaz Memiliki Tugas Belum Selesai`}
              </h2>
              <p className="text-sm text-slate-600 mt-0.5">
                {activePeriod?.endDate
                  ? `Periode aktif (${activePeriod.name}) berakhir pada ${activePeriod.endDate}.`
                  : 'Atur tanggal akhir periode di menu Pengaturan untuk mendeteksi status tenggat waktu.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setOnlyPendingReminder((v) => !v)}
              aria-pressed={onlyPendingReminder}
              className={`min-h-[44px] px-4 rounded-xl border text-sm font-semibold transition-colors whitespace-nowrap ${
                onlyPendingReminder
                  ? 'bg-emerald-800 border-emerald-800 text-white'
                  : 'bg-white border-slate-300 hover:bg-slate-50 text-slate-800'
              }`}
            >
              {onlyPendingReminder
                ? `Menampilkan Perlu Pengingat (${urgentReminderSummary.totalPendingUstaz})`
                : `Filter Perlu Pengingat (${urgentReminderSummary.totalPendingUstaz})`}
            </button>
          </div>
        </section>
      )}

      {/* Filters */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label htmlFor="mon-ustaz" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            Filter Ustaz
          </label>
          <select
            id="mon-ustaz"
            value={filterUstazId}
            onChange={(e) => setFilterUstazId(e.target.value)}
            className="w-full min-h-[46px] px-3 rounded-xl border border-slate-300 text-sm bg-[#F9FBFA] focus:bg-white"
          >
            <option value="all">Semua Ustaz</option>
            {ustazList.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="mon-class" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            Filter Kelas
          </label>
          <select
            id="mon-class"
            value={filterClassId}
            onChange={(e) => setFilterClassId(e.target.value)}
            className="w-full min-h-[46px] px-3 rounded-xl border border-slate-300 text-sm bg-[#F9FBFA] focus:bg-white"
          >
            <option value="all">Semua Kelas</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="mon-subject" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            Filter Mata Pelajaran
          </label>
          <select
            id="mon-subject"
            value={filterSubjectId}
            onChange={(e) => setFilterSubjectId(e.target.value)}
            className="w-full min-h-[46px] px-3 rounded-xl border border-slate-300 text-sm bg-[#F9FBFA] focus:bg-white"
          >
            <option value="all">Semua Mapel</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="mon-status" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            Filter Status
          </label>
          <select
            id="mon-status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full min-h-[46px] px-3 rounded-xl border border-slate-300 text-sm bg-[#F9FBFA] focus:bg-white"
          >
            <option value="all">Semua Status</option>
            <option value="belum_mulai">Belum Mulai</option>
            <option value="dalam_proses">Dalam Proses</option>
            <option value="terkirim">Terkirim</option>
            <option value="terkunci">Terkunci</option>
          </select>
        </div>
      </div>

      {/* Ustaz Cards Side by Side */}
      {displayedCandidates.length === 0 ? (
        <section className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#F0F7F4] text-emerald-700 flex items-center justify-center mx-auto mb-3">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <p className="font-display text-lg font-bold text-slate-900">
            {ustazList.length === 0
              ? 'Belum Ada Data Ustaz & Tugas'
              : onlyPendingReminder
              ? 'Tidak Ada Ustaz yang Memerlukan Pengingat'
              : 'Tidak Ada Ustaz yang Sesuai Filter'}
          </p>
          <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
            {ustazList.length === 0
              ? 'Tambahkan data ustaz dan pemetaan tugas terlebih dahulu agar progres penilaian dapat dipantau di sini.'
              : onlyPendingReminder
              ? 'Seluruh ustaz yang terfilter telah menyelesaikan tugas penilaiannya.'
              : 'Coba ubah filter ustaz, kelas, mata pelajaran, atau status di atas.'}
          </p>
        </section>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedCandidates.map((candidate) => {
            const u = candidate.ustaz;
            const prog = computeUstazProgress(
              u.id,
              assignments.filter((a) => {
                if (filterClassId !== 'all' && a.classId !== filterClassId) return false;
                if (filterSubjectId !== 'all' && a.subjectId !== filterSubjectId) return false;
                return true;
              })
            );
            const isUrgent =
              candidate.needsReminder &&
              (candidate.urgency.level === 'due_soon' || candidate.urgency.level === 'overdue');

            return (
              <div
                key={u.id}
                className={`bg-white border rounded-2xl shadow-xs p-5 flex flex-col justify-between gap-4 transition-colors ${
                  isUrgent
                    ? 'border-amber-300 hover:border-amber-400'
                    : 'border-slate-200/90 hover:border-emerald-600/40'
                }`}
              >
                <div className="space-y-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="font-display text-lg font-bold text-slate-900 truncate">{u.name}</h2>
                      <p className="text-sm font-mono text-slate-500 tabular-nums">
                        {u.whatsapp || 'Nomor WA belum diisi'}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-bold shrink-0 ${
                        prog.overallStatus === 'Selesai'
                          ? 'text-emerald-700'
                          : prog.overallStatus === 'Dalam Proses'
                          ? 'text-amber-700'
                          : 'text-slate-500'
                      }`}
                    >
                      {prog.overallStatus}
                    </span>
                  </div>

                  {candidate.needsReminder && candidate.urgency.level !== 'no_deadline' && (
                    <div
                      className={`flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl border ${
                        candidate.urgency.level === 'overdue'
                          ? 'bg-red-50 border-red-200 text-red-800'
                          : candidate.urgency.level === 'due_soon'
                          ? 'bg-amber-50 border-amber-200 text-amber-900'
                          : 'bg-[#F6F8F7] border-slate-200 text-slate-700'
                      }`}
                    >
                      {candidate.urgency.level === 'overdue' ? (
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                      ) : (
                        <Clock className="w-4 h-4 shrink-0" />
                      )}
                      <span>{candidate.urgency.label}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-3 divide-x divide-slate-200 text-center bg-[#F6F8F7] border border-slate-200/80 rounded-xl py-2.5 text-xs">
                    <div>
                      <p className="text-slate-500">Tugas</p>
                      <p className="text-base font-bold text-slate-900 tabular-nums">{prog.totalTasks}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Selesai</p>
                      <p className="text-base font-bold text-emerald-700 tabular-nums">
                        {prog.completedTasks}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Belum</p>
                      <p className="text-base font-bold text-amber-700 tabular-nums">
                        {prog.pendingTasks}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-slate-600 tabular-nums">
                      <span>Progres Pengisian</span>
                      <span>{prog.percentage}%</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-800 to-emerald-600 transition-all"
                        style={{ width: `${prog.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => openWhatsappModal(candidate)}
                  className={`w-full min-h-[46px] px-4 rounded-xl font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
                    isUrgent
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : 'bg-emerald-800 hover:bg-emerald-900 text-white'
                  }`}
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>
                    {isUrgent
                      ? 'Buat Link WA (Segera)'
                      : candidate.needsReminder
                      ? 'Buat Link Pengingat WA'
                      : 'Kirim Pesan WhatsApp'}
                  </span>
                </button>
              </div>
            );
          })}
        </section>
      )}

      {/* Detailed Tasks Table with Unlock Control */}
      <section className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200">
          <h2 className="font-display text-lg font-bold text-slate-900">
            Rincian Tugas Penilaian &amp; Pembukaan Kunci
          </h2>
          <p className="text-sm text-slate-500">
            Pembukaan kunci hanya berlaku untuk mata pelajaran terpilih dan wajib menyertakan alasan.
          </p>
        </div>

        {filteredAssignments.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Belum ada tugas penilaian yang sesuai filter saat ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#F9FBFA] border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-5">Ustaz</th>
                  <th className="py-3.5 px-4">Kelas</th>
                  <th className="py-3.5 px-4">Mata Pelajaran</th>
                  <th className="py-3.5 px-4">Pengisian</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAssignments.map((a) => {
                  const locked = a.status === 'terkunci' || a.status === 'terkirim';
                  return (
                    <tr key={a.id} className="hover:bg-[#F6F8F7]/60 transition-colors">
                      <td className="py-3.5 px-5 font-semibold text-slate-900">{a.ustazName}</td>
                      <td className="py-3.5 px-4 text-slate-700">{a.className}</td>
                      <td className="py-3.5 px-4 text-slate-800">{a.subjectName}</td>
                      <td className="py-3.5 px-4 tabular-nums">
                        {a.filledCount}/{a.totalStudents}
                      </td>
                      <td className="py-3.5 px-4 font-semibold">
                        <span className={`inline-flex items-center gap-1 ${locked ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {locked && <Lock className="w-3.5 h-3.5" />}
                          <span>{getStatusLabel(a.status)}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        {locked ? (
                          <button
                            type="button"
                            onClick={() => {
                              setUnlockTarget(a);
                              setUnlockReason('');
                              setUnlockError('');
                            }}
                            className="min-h-[42px] px-3.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-semibold text-xs inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                            <span>Buka Kembali</span>
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">Terbuka</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Audit Log History */}
      <section className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center gap-2.5">
          <History className="w-5 h-5 text-emerald-700" />
          <h2 className="font-display text-lg font-bold text-slate-900">Riwayat Perubahan &amp; Pembukaan Nilai</h2>
        </div>
        {auditLogs.length === 0 ? (
          <p className="p-8 text-sm text-slate-500 text-center">Belum ada riwayat perubahan nilai.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#F9FBFA] border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-5">Waktu</th>
                  <th className="py-3.5 px-4">Aksi</th>
                  <th className="py-3.5 px-4">Kelas &amp; Mapel</th>
                  <th className="py-3.5 px-4">Nilai Lama → Baru</th>
                  <th className="py-3.5 px-4">Pengguna</th>
                  <th className="py-3.5 px-5">Alasan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.slice(0, 20).map((log) => (
                  <tr key={log.id} className="hover:bg-[#F6F8F7]/60 transition-colors">
                    <td className="py-3 px-5 text-xs text-slate-500 tabular-nums whitespace-nowrap">
                      {log.createdAt ? new Date(log.createdAt).toLocaleString('id-ID') : '-'}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{log.action}</td>
                    <td className="py-3 px-4">
                      {log.className} · {log.subjectName}
                      {log.studentName ? ` (${log.studentName})` : ''}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums">
                      {log.oldScore !== null && log.oldScore !== undefined ? `${log.oldScore} → ${log.newScore}` : '-'}
                    </td>
                    <td className="py-3 px-4">{log.changedByName}</td>
                    <td className="py-3 px-5 text-slate-600">{log.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Customizable WhatsApp API Link Generator Modal */}
      {waCandidate && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold text-slate-900">
                  Link Pengingat WhatsApp Otomatis
                </h2>
                <p className="text-sm text-slate-600">
                  Tujuan: <span className="font-semibold text-slate-900">{waCandidate.ustaz.name}</span>{' '}
                  ({waCandidate.ustaz.whatsapp || 'Nomor belum diisi — tautan tetap dapat disalin'})
                </p>
              </div>
              <button
                type="button"
                aria-label="Tutup dialog WhatsApp"
                onClick={() => setWaCandidate(null)}
                className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Preset Tone Selector */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Pilih Template Nada Pesan
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(
                  [
                    { id: 'ramah', label: 'Pengingat Standar' },
                    { id: 'tenggat', label: 'Mendekati Tenggat' },
                    { id: 'mendesak', label: 'Tindak Lanjut Segera' },
                  ] as const
                ).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleToneChange(preset.id)}
                    className={`min-h-[42px] px-3 rounded-xl border text-xs font-semibold transition-colors ${
                      waTone === preset.id
                        ? 'bg-emerald-800 border-emerald-800 text-white'
                        : 'bg-[#F9FBFA] border-slate-200 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="wa-message-box" className="block text-sm font-semibold text-slate-800 mb-1.5">
                Sesuaikan Isi Pesan Sebelum Dikirim
              </label>
              <textarea
                id="wa-message-box"
                rows={7}
                value={waMessage}
                onChange={(e) => {
                  setWaMessage(e.target.value);
                  setCopiedLink(false);
                }}
                className="w-full p-3.5 rounded-xl border border-slate-300 bg-[#F9FBFA] focus:bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 leading-relaxed"
              />
            </div>

            {/* Live Generated WhatsApp API URL Box */}
            <div className="p-3.5 rounded-xl bg-[#F6F8F7] border border-slate-200 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Link API WhatsApp Otomatis
                </span>
                <button
                  type="button"
                  onClick={handleCopyWaLink}
                  className="min-h-[34px] px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-700" />
                      <span className="text-emerald-700">Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin Link WA</span>
                    </>
                  )}
                </button>
              </div>
              <p
                data-testid="generated-wa-url"
                className="text-xs font-mono text-slate-600 break-all line-clamp-2"
              >
                {generatedWaUrl}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-end pt-1">
              <button
                type="button"
                onClick={() => setWaCandidate(null)}
                className="min-h-[48px] px-5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 font-semibold text-slate-700"
              >
                Batal
              </button>
              <a
                href={generatedWaUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setWaCandidate(null)}
                className="min-h-[48px] px-5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold inline-flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Buka WhatsApp &amp; Kirim</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Unlock Assignment Reason Modal */}
      {unlockTarget && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h2 className="font-display text-xl font-bold text-slate-900">Buka Kembali Tugas Terkunci</h2>
            <p className="text-sm text-slate-600">
              {unlockTarget.subjectName} — Kelas {unlockTarget.className} ({unlockTarget.ustazName})
            </p>

            <div>
              <label htmlFor="unlock-reason" className="block text-sm font-semibold text-slate-800 mb-1.5">
                Alasan Pembukaan (Wajib Dicatat)
              </label>
              <textarea
                id="unlock-reason"
                rows={3}
                value={unlockReason}
                onChange={(e) => {
                  setUnlockReason(e.target.value);
                  setUnlockError('');
                }}
                placeholder="Tuliskan alasan pembukaan kunci tugas ini..."
                className="w-full p-3.5 rounded-xl border border-slate-300 bg-[#F9FBFA] focus:bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              />
              {unlockError && <p className="text-sm text-red-700 mt-1">{unlockError}</p>}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setUnlockTarget(null)}
                className="min-h-[48px] px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 font-semibold text-slate-700"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={unlocking}
                onClick={handleConfirmUnlock}
                className="min-h-[48px] px-5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold"
              >
                {unlocking ? 'Membuka...' : 'Buka Kunci Tugas'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
