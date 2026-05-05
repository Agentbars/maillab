'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'

const NAV = [
  { href: '/inbox',   label: 'Inbox'   },
  { href: '/compose', label: 'Compose' },
  { href: '/disk',    label: 'Disk'    },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <aside className="w-52 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
      <div className="px-5 py-4 border-b border-gray-200">
        <span className="text-lg font-bold text-blue-700">MailLab</span>
      </div>
      <nav className="flex-1 p-3 space-y-0.5">
        {NAV.map(({ href, label }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-gray-200 space-y-2">
        <p className="text-xs text-gray-500 truncate">{session?.user?.email}</p>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-xs text-red-500 hover:text-red-700 transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
