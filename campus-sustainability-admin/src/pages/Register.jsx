import { Link } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'

export default function Register() {
  return <AuthLayout eyebrow="Account access" title="Accounts are administrator-provisioned" subtitle="New administrator and maintenance accounts are created through the approved campus administration process."><p className="auth-switch">Use your assigned credentials to access the portal.</p><Link className="btn-primary" to="/login">Go to sign in</Link></AuthLayout>
}
