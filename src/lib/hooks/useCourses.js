'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Fetches all active courses, structured by track + college.
 *
 * Returns:
 *   tree: {
 *     preparatory: { plans: { a: { subjects: [...] }, b: {...} } },
 *     bachelor:    { colleges: [{ id, label, programs: [...] }] },
 *     diploma:     { programs: [...] },
 *     graduate:    { programs: [...] }
 *   }
 *   all: flat array
 *   loading
 */
export function useCourseTree() {
  const supabase = createClient()
  const [tree, setTree] = useState(null)
  const [all, setAll] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const [{ data: colleges }, { data: courses }] = await Promise.all([
        supabase.from('colleges').select('*').order('sort_order'),
        supabase.from('courses').select('*').eq('is_active', true).order('name_ar'),
      ])

      if (cancelled) return

      setAll(courses || [])

      const t = {
        preparatory: { label: 'السنة التحضيرية', plans: { a: { label: 'الخطة (أ)', subjects: [] }, b: { label: 'الخطة (ب)', subjects: [] } } },
        bachelor: { label: 'بكالوريوس', colleges: (colleges || []).map(c => ({ ...c, programs: [] })) },
        diploma: { label: 'دبلوم', programs: [] },
        graduate: { label: 'دراسات عليا', programs: [] },
      }

      ;(courses || []).forEach(c => {
        if (c.track === 'preparatory') {
          if (c.plan === 'a' || c.plan === 'b') t.preparatory.plans[c.plan].subjects.push(c)
        } else if (c.track === 'bachelor') {
          const col = t.bachelor.colleges.find(x => x.id === c.college_id)
          if (col) col.programs.push(c)
        } else if (c.track === 'diploma') {
          t.diploma.programs.push(c)
        } else if (c.track === 'graduate') {
          t.graduate.programs.push(c)
        }
      })

      setTree(t)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [supabase])

  return { tree, all, loading }
}

/**
 * Fetches files for a specific course, grouped by category.
 */
export function useCourseFiles(courseId) {
  const supabase = createClient()
  const [files, setFiles] = useState({ collections: [], plans: [], curriculum: [], programs: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!courseId) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('files')
        .select('*')
        .eq('course_id', courseId)
        .eq('is_approved', true)
        .order('created_at', { ascending: false })

      if (cancelled) return

      const grouped = { collections: [], plans: [], curriculum: [], programs: [] }
      ;(data || []).forEach(f => {
        if (grouped[f.category]) grouped[f.category].push(f)
      })

      setFiles(grouped)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [courseId, supabase])

  /**
   * Generate a signed download URL (valid 60 sec) + log the download.
   */
  const downloadFile = useCallback(async (fileId) => {
    const { data: file } = await supabase
      .from('files')
      .select('storage_path, title')
      .eq('id', fileId)
      .single()

    if (!file) return { error: 'file_not_found' }

    const { data: signed, error } = await supabase
      .storage
      .from('course-files')
      .createSignedUrl(file.storage_path, 60, { download: file.title + '.pdf' })

    if (error || !signed) return { error: error?.message || 'sign_failed' }

    await supabase.rpc('log_download', { file_uuid: fileId })

    return { url: signed.signedUrl }
  }, [supabase])

  /**
   * Rate a file (1-5 stars)
   */
  const rateFile = useCallback(async (fileId, rating, comment = null) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'not_authenticated' }
    const { error } = await supabase
      .from('file_ratings')
      .upsert({
        user_id: user.id,
        file_id: fileId,
        rating,
        comment,
      }, { onConflict: 'user_id,file_id' })
    if (error) return { error: error.message }
    return { ok: true }
  }, [supabase])

  return { files, loading, downloadFile, rateFile }
}

/**
 * Records a course view (recent + analytics).
 */
export function useViewCourse() {
  const supabase = createClient()

  return useCallback(async (courseId) => {
    if (!courseId) return
    await supabase.rpc('increment_course_view', { course_uuid: courseId })
  }, [supabase])
}
