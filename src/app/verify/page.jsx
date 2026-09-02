import { redirect } from 'next/navigation'

/**
 * The site no longer has student accounts — everyone enters directly and their
 * profile lives on their device. This route stayed behind as a dead end for
 * bookmarks and stale links, so it sends anyone who lands here to the app.
 */
export default function Page() {
  redirect('/')
}
