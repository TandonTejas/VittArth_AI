import { useEffect, useMemo, useState } from 'react'
import { getCategories } from '../../api/client'

const normalize = value => String(value || '').toLowerCase().replace(/[_:]+/g, ' ').trim()

const formatCategory = category => {
  if (!category) return 'Uncategorized'
  return category
    .split(':')
    .map(part => part.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase()))
    .join(' / ')
}

export default function CategoryCorrection({ currentCategory, vendorName, onCategoryUpdate }) {
  const [expanded, setExpanded] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [savingCategory, setSavingCategory] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [hasUpdatedCategory, setHasUpdatedCategory] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 160)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (!expanded || categories.length) return
    setLoading(true)
    setError(null)
    getCategories()
      .then(setCategories)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [expanded, categories.length])

  useEffect(() => {
    if (!feedback) return
    const timer = setTimeout(() => setFeedback(null), 1800)
    return () => clearTimeout(timer)
  }, [feedback])

  const filteredGroups = useMemo(() => {
    const query = normalize(debouncedSearch)
    const matches = categories.filter(item => {
      if (!query) return true
      return [
        item.key,
        item.label,
        item.category_name,
        item.subcategory_name,
        item.parent,
      ].some(value => normalize(value).includes(query))
    })

    return matches.reduce((groups, item) => {
      const parent = item.parent || item.category_name || 'Other'
      groups[parent] = groups[parent] || []
      groups[parent].push(item)
      return groups
    }, {})
  }, [categories, debouncedSearch])

  const selectCategory = async category => {
    if (category === currentCategory || savingCategory) return
    setSavingCategory(category)
    setError(null)
    try {
      await onCategoryUpdate(category)
      setFeedback('Updated. Click Done to finish.')
      setHasUpdatedCategory(true)
      setSearch('')
    } catch (e) {
      setError(e.message)
    } finally {
      setSavingCategory(null)
    }
  }

  const hasVendor = Boolean(String(vendorName || '').trim())
  const groupEntries = Object.entries(filteredGroups)
  const thankUser = () => {
    setExpanded(false)
    setHasUpdatedCategory(false)
    setFeedback('Thank you for your feedback.')
  }

  return (
    <section className="mt-4 rounded-lg border border-sky-400/15 bg-slate-950/30 p-3">
      <div className="flex flex-col gap-3">
        <div>
          <p className="m-0 text-[13px] font-extrabold text-slate-100">Is this category correct?</p>
          <p className="m-0 mt-1 text-xs font-semibold text-slate-400">
            Current: <span className="text-sky-300">{formatCategory(currentCategory)}</span>
          </p>
          {!hasVendor && (
            <p className="m-0 mt-1 text-xs text-amber-200">
              No vendor detected. This will update only this transaction.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              thankUser()
            }}
            className="rounded-lg border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-sm font-bold text-emerald-200 transition hover:bg-emerald-300/15"
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => {
              setExpanded(value => !value)
              setFeedback(null)
              setHasUpdatedCategory(false)
            }}
            className="rounded-lg border border-sky-300/25 bg-sky-300/10 px-3 py-2 text-sm font-bold text-sky-100 transition hover:bg-sky-300/15"
          >
            No
          </button>
        </div>

        {feedback && (
          <div className="rounded-lg border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-xs font-bold text-emerald-200">
            {feedback}
          </div>
        )}
      </div>

      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
          expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="mt-3 border-t border-sky-300/10 pt-3">
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search categories or subcategories"
              className="w-full rounded-lg border border-sky-300/20 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            />

            {hasUpdatedCategory && (
              <button
                type="button"
                onClick={thankUser}
                className="mt-3 w-full rounded-lg border border-emerald-300/30 bg-emerald-300/12 px-3 py-2 text-sm font-bold text-emerald-100 transition hover:bg-emerald-300/18"
              >
                Done
              </button>
            )}

            <div className="mt-3 max-h-72 overflow-y-auto pr-1">
              {loading && <div className="px-2 py-6 text-center text-sm text-slate-400">Loading categories...</div>}
              {error && <div className="rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs text-red-200">{error}</div>}
              {!loading && !error && groupEntries.length === 0 && (
                <div className="px-2 py-6 text-center text-sm text-slate-400">No categories found.</div>
              )}
              {!loading && !error && groupEntries.map(([group, items]) => (
                <div key={group} className="mb-3">
                  <div className="sticky top-0 bg-[#080a21] px-2 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                    {group}
                  </div>
                  <div className="mt-1 flex flex-col gap-1">
                    {items.map(item => {
                      const selected = item.key === currentCategory
                      const saving = savingCategory === item.key
                      return (
                        <button
                          type="button"
                          key={item.key}
                          disabled={selected || Boolean(savingCategory)}
                          onClick={() => selectCategory(item.key)}
                          className={`rounded-lg border px-3 py-2 text-left transition ${
                            selected
                              ? 'border-emerald-300/45 bg-emerald-300/12 text-emerald-100'
                              : 'border-sky-300/10 bg-slate-900/50 text-slate-200 hover:border-sky-300/35 hover:bg-sky-300/10'
                          } ${savingCategory && !saving ? 'opacity-55' : ''}`}
                        >
                          <span className="block text-sm font-bold">{item.label}</span>
                          <span className="mt-0.5 block text-xs text-slate-500">{item.key}</span>
                          {saving && <span className="mt-1 block text-xs font-bold text-sky-200">Updating...</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
