import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useLang } from '../lib/i18n'
import { ReportView } from '../components/Report'
import { ErrorNote, Loading } from '../components/Shell'

// Opened from a shared link (WhatsApp, print): no sign-in, no personal details.
export default function PublicReport() {
  const { token } = useParams()
  const { lang } = useLang()
  const [rep, setRep] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => { api.sharedReport(token, lang).then(setRep).catch((e) => setErr(e.message)) }, [token, lang])
  return (
    <div className="content" style={{ margin: '0 auto' }}>
      <ErrorNote error={err} />
      {!rep && !err && <Loading />}
      {rep && <ReportView report={rep} />}
    </div>
  )
}
