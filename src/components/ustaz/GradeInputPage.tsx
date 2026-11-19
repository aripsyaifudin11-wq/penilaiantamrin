import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Cloud,
  CloudOff,
  Loader2,
  Lock,
  Send,
} from 'lucide-react';
import { usePortal } from '../../services/portalContext';
import type { Assignment } from '../../types/portal';
import { canSubmitAssignment } from '../../utils/grading';
import { parseScoreInput } from '../../utils/validation';

interface GradeInputPageProps {
  assignmentId: string;
  onBackDashboard: () => void;
}

export function GradeInputPage({ assignmentId, onBackDashboard }: GradeInputPageProps) {
  const {
    assignments,
    students,
    gradesByAssignmentId,
    loadGradesForAssignment,
    saveDraftScore,
    submitAssignmentFinal,
    syncState,
    isOnline,
    notify,
  } = usePortal();

  const assignment: Assignment | undefined = useMemo(
    () => assignments.find((a) => a.id === assignmentId),
    [assignments, assignmentId]
  );

  const classStudents = useMemo(() => {
    if (!assignment) return [];
    return students
      .filter((s) => s.classId === assignment.classId && s.isActive)
      .sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [assignment, students]);

  const [rawInputs, setRawInputs] = useState<Record<string, string>>({});
  const [inputErrors, setInputErrors] = useState<Record<string, string>>({});
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingGrades, setLoadingGrades] = useState(true);

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    let active = true;
    async function fetchGrades() {
      setLoadingGrades(true);
      try {
        const loaded = await loadGradesForAssignment(assignmentId);
        if (!active) return;
        const map: Record<string, string> = {};
        loaded.forEach((g) => {
          if (g.score !== null && g.score !== undefined) {
            map[g.studentId] = String(g.score);
          }
        });
        setRawInputs(map);
      } finally {
        if (active) setLoadingGrades(false);
      }
    }
    fetchGrades();
    return () => {
      active = false;
    };
  }, [assignmentId, loadGradesForAssignment]);

  useEffect(() => {
    const existing = gradesByAssignmentId[assignmentId];
    if (!existing) return;
    setRawInputs((prev) => {
      const next = { ...prev };
      existing.forEach((g) => {
        if (next[g.studentId] === undefined && g.score !== null && g.score !== undefined) {
          next[g.studentId] = String(g.score);
        }
      });
      return next;
    });
  }, [assignmentId, gradesByAssignmentId]);

  const parsedScoresByStudentId = useMemo(() => {
    const res: Record<string, number | null> = {};
    for (const s of classStudents) {
      const parsed = parseScoreInput(rawInputs[s.id] || '');
      res[s.id] = parsed.valid ? parsed.score : null;
    }
    return res;
  }, [classStudents, rawInputs]);

  const completeness = useMemo(
    () => canSubmitAssignment(classStudents, parsedScoresByStudentId),
    [classStudents, parsedScoresByStudentId]
  );

  if (!assignment) {
    return (
      <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-3xl p-8 text-center">
        <h1 className="font-display text-2xl font-bold text-slate-900 mb-3">Tugas Tidak Ditemukan</h1>
        <button
          type="button"
          onClick={onBackDashboard}
          className="min-h-[52px] px-6 rounded-xl bg-emerald-800 text-white font-semibold"
        >
          Kembali ke Dashboard
        </button>
      </div>
    );
  }

  const isLocked = assignment.status === 'terkunci' || assignment.status === 'terkirim';

  const handleScoreChange = (studentId: string, value: string) => {
    if (isLocked) return;
    const cleaned = value.replace(/[^0-9-]/g, '');
    setRawInputs((prev) => ({ ...prev, [studentId]: cleaned }));

    const parsed = parseScoreInput(cleaned);
    if (!parsed.valid) {
      setInputErrors((prev) => ({ ...prev, [studentId]: parsed.error || 'Nilai tidak valid' }));
      return;
    }
    setInputErrors((prev) => {
      const next = { ...prev };
      delete next[studentId];
      return next;
    });

    const student = classStudents.find((s) => s.id === studentId);
    if (student) {
      saveDraftScore({
        assignment,
        student,
        score: parsed.score,
        allStudents: classStudents,
      }).catch(() => {});
    }
  };

  const handleNextStudent = (index: number) => {
    const currentStudent = classStudents[index];
    if (!currentStudent) return;
    const raw = rawInputs[currentStudent.id] || '';
    const parsed = parseScoreInput(raw);
    if (!parsed.valid || parsed.score === null) {
      setInputErrors((prev) => ({
        ...prev,
        [currentStudent.id]: parsed.error || 'Isi nilai angka 0–100 terlebih dahulu.',
      }));
      inputRefs.current[currentStudent.id]?.focus();
      return;
    }

    const nextStudent = classStudents[index + 1];
    if (nextStudent) {
      setFocusedIndex(index + 1);
      const nextInput = inputRefs.current[nextStudent.id];
      if (nextInput) {
        nextInput.focus();
        nextInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      setShowConfirmModal(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleNextStudent(index);
    }
  };

  const handleConfirmFinalSubmit = async () => {
    if (!completeness.ready) {
      setShowConfirmModal(false);
      const firstMissing = completeness.missingStudents[0];
      if (firstMissing) {
        setInputErrors((prev) => ({
          ...prev,
          [firstMissing.id]: 'Nilai santri ini wajib diisi (0–100) sebelum dikirim.',
        }));
        const el = inputRefs.current[firstMissing.id];
        el?.focus();
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      notify(
        'warning',
        'Nilai Belum Lengkap',
        `Masih ada ${completeness.missingStudents.length} santri yang belum diisi nilainya.`
      );
      return;
    }

    setSubmitting(true);
    const result = await submitAssignmentFinal({
      assignment,
      students: classStudents,
      scoresByStudentId: parsedScoresByStudentId,
    });
    setSubmitting(false);
    if (result.ok) {
      setShowConfirmModal(false);
      onBackDashboard();
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-12">
      {/* Top Assignment Info Card */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-7 space-y-4 shadow-[0_1px_3px_rgba(15,23,42,0.03)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBackDashboard}
            className="min-h-[48px] px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-base inline-flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Kembali ke Daftar Tugas</span>
          </button>

          <div className="inline-flex items-center gap-2 text-sm font-semibold px-3.5 py-2 rounded-xl bg-[#F6F8F7] border border-slate-200/80">
            {!isOnline || syncState === 'offline' ? (
              <>
                <CloudOff className="w-4 h-4 text-amber-600" />
                <span className="text-amber-800">Koneksi Terputus · Draft Disimpan Lokal</span>
              </>
            ) : syncState === 'saving' ? (
              <>
                <Loader2 className="w-4 h-4 text-emerald-700 animate-spin" />
                <span className="text-emerald-800">Menyimpan otomatis...</span>
              </>
            ) : (
              <>
                <Cloud className="w-4 h-4 text-emerald-700" />
                <span className="text-emerald-800">Tersimpan Otomatis</span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pt-3 border-t border-slate-100">
          <div>
            <p className="text-sm font-semibold text-emerald-800">
              Kelas {assignment.className} · {assignment.periodName}
            </p>
            <h1 className="font-display text-2xl sm:text-[30px] font-bold text-slate-900 mt-0.5 tracking-tight">
              Input Nilai {assignment.subjectName}
            </h1>
          </div>
          <div className="text-base font-bold text-emerald-900 tabular-nums font-mono">
            Terisi {completeness.filledCount} / {completeness.totalStudents} Santri
          </div>
        </div>

        {isLocked && (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-[#F0F7F4] border border-emerald-200 text-emerald-950">
            <Lock className="w-5 h-5 shrink-0 mt-0.5 text-emerald-800" />
            <div>
              <p className="font-bold text-base">Nilai Sudah Terkirim dan Terkunci</p>
              <p className="text-sm text-emerald-800">
                Nilai tidak dapat diubah kembali oleh ustaz. Hubungi Admin jika perlu pembukaan ulang.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Student Grading List */}
      {loadingGrades ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white border border-slate-200/80 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : classStudents.length === 0 ? (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-10 text-center">
          <p className="font-display text-lg font-bold text-slate-900 mb-1">Belum Ada Santri di Kelas Ini</p>
          <p className="text-base text-slate-600">
            Admin perlu menambahkan data santri pada kelas {assignment.className}.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {classStudents.map((student, index) => {
            const rawVal = rawInputs[student.id] ?? '';
            const parsed = parseScoreInput(rawVal);
            const hasValidScore = parsed.valid && parsed.score !== null;
            const errorMsg = inputErrors[student.id];
            const isLast = index === classStudents.length - 1;
            const isFocused = focusedIndex === index;
            const showActionBtn = !isLocked && (hasValidScore || isFocused || isLast);

            return (
              <div
                key={student.id}
                className={`border rounded-2xl p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-colors ${
                  errorMsg
                    ? 'border-red-400 bg-red-50/30'
                    : isFocused && !isLocked
                    ? 'border-emerald-600 ring-2 ring-emerald-100 bg-[#F4FAF7]'
                    : 'border-slate-200/90 bg-white'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <span
                      className={`w-11 h-11 rounded-xl font-bold text-lg flex items-center justify-center tabular-nums shrink-0 font-mono ${
                        hasValidScore
                          ? 'bg-emerald-800 text-white'
                          : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <label
                        htmlFor={`nilai-${student.id}`}
                        className="block font-display text-xl font-bold text-slate-900 leading-snug cursor-pointer"
                      >
                        {student.name}
                      </label>
                      <div className="mt-1 flex items-center gap-2 text-sm font-medium">
                        {hasValidScore ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-800">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Sudah terisi</span>
                          </span>
                        ) : (
                          <span className="text-slate-500">Belum diisi (angka 0–100)</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Oversized Numeric Score Input (>= 22px) */}
                  <div className="sm:w-44 shrink-0">
                    <input
                      ref={(el) => {
                        inputRefs.current[student.id] = el;
                      }}
                      id={`nilai-${student.id}`}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      enterKeyHint={isLast ? 'done' : 'next'}
                      disabled={isLocked}
                      value={rawVal}
                      onFocus={() => setFocusedIndex(index)}
                      onChange={(e) => handleScoreChange(student.id, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, index)}
                      placeholder="0–100"
                      aria-label={`Nilai untuk ${student.name}`}
                      className={`w-full min-h-[64px] px-4 rounded-xl border text-center font-mono text-[28px] font-bold tabular-nums transition-colors focus:outline-none ${
                        isLocked
                          ? 'bg-slate-100 border-slate-200 text-slate-700'
                          : errorMsg
                          ? 'bg-white border-red-500 text-red-700 focus:ring-2 focus:ring-red-200'
                          : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700'
                      }`}
                    />
                  </div>
                </div>

                {errorMsg && (
                  <div role="alert" className="mt-3 flex items-center gap-2 text-sm font-semibold text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {showActionBtn && (
                  <div className="mt-4 pt-4 border-t border-slate-200/70">
                    {isLast ? (
                      <button
                        type="button"
                        onClick={() => setShowConfirmModal(true)}
                        className="w-full min-h-[56px] px-6 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-lg inline-flex items-center justify-center gap-2.5 transition-colors shadow-xs"
                      >
                        <Send className="w-5 h-5" />
                        <span>SELESAI &amp; KIRIM NILAI</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleNextStudent(index)}
                        disabled={!hasValidScore}
                        className={`w-full min-h-[54px] px-6 rounded-xl font-bold text-lg inline-flex items-center justify-center gap-2 transition-colors ${
                          hasValidScore
                            ? 'bg-emerald-800 hover:bg-emerald-900 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <span>NEXT (Santri Berikutnya)</span>
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {!isLocked && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                className="w-full min-h-[56px] px-6 rounded-xl bg-[#064E3B] hover:bg-emerald-950 text-white font-bold text-lg inline-flex items-center justify-center gap-2.5 shadow-sm transition-colors"
              >
                <Send className="w-5 h-5 text-[#F1D98A]" />
                <span>SELESAI &amp; KIRIM NILAI ({completeness.filledCount}/{completeness.totalStudents})</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {showConfirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-xs p-4"
        >
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-5">
            <h2 id="submit-modal-title" className="font-display text-2xl font-bold text-slate-900">
              KIRIM NILAI SEKARANG?
            </h2>

            <div className="bg-[#F6F8F7] border border-slate-200 rounded-2xl p-4 space-y-2.5 text-base">
              <div className="flex justify-between gap-4">
                <span className="text-slate-600">Kelas</span>
                <span className="font-bold text-slate-900">{assignment.className}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-600">Mata Pelajaran</span>
                <span className="font-bold text-slate-900">{assignment.subjectName}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-600">Jumlah Santri</span>
                <span className="font-bold text-slate-900 tabular-nums">
                  {completeness.totalStudents} Santri
                </span>
              </div>
              <div className="flex justify-between gap-4 pt-2.5 border-t border-slate-200">
                <span className="text-slate-600">Status Kelengkapan</span>
                <span
                  className={`font-bold tabular-nums ${
                    completeness.ready ? 'text-emerald-800' : 'text-red-700'
                  }`}
                >
                  {completeness.ready
                    ? `Lengkap (${completeness.filledCount}/${completeness.totalStudents})`
                    : `Belum Lengkap (${completeness.filledCount}/${completeness.totalStudents})`}
                </span>
              </div>
            </div>

            {!completeness.ready && (
              <div role="alert" className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm font-medium">
                Masih ada {completeness.missingStudents.length} santri yang nilainya kosong (seperti{' '}
                <strong>{completeness.missingStudents[0]?.name}</strong>). Nilai kosong tidak dapat dikirim.
              </div>
            )}

            <p className="text-sm text-slate-600">
              Setelah dikirim, status nilai akan menjadi <strong>TERKIRIM &amp; TERKUNCI</strong> agar tidak berubah secara tidak sengaja.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 min-h-[54px] px-5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold text-base"
              >
                PERIKSA KEMBALI
              </button>
              <button
                type="button"
                disabled={submitting || !completeness.ready}
                onClick={handleConfirmFinalSubmit}
                className="flex-1 min-h-[54px] px-5 rounded-xl bg-emerald-800 hover:bg-emerald-900 disabled:bg-slate-300 text-white font-bold text-base"
              >
                {submitting ? 'Mengirim...' : 'YA, KIRIM NILAI'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
