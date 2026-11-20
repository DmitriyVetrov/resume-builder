import { Component, useState, type ReactNode } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import './shell.css';
import { SessionProvider } from '../features/account/session';
import { Account, Login, ResetPassword, SignUp, VerifyEmail } from '../features/account/Account';
import { EditorPage } from '../features/editor/Workspace';
import ImportPage from '../features/import/ImportPage';
import { LibraryPage, TrashPage } from '../features/library/Library';
import { buttonClass } from '../shared/ui';
import { ThemeSwitch } from './ThemeSwitch';

class RouteBoundary extends Component<{ children: ReactNode; onHome: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main id="main-content"><div role="alert"><h1>Something went wrong</h1><p>This page could not be shown.</p></div><button className={buttonClass()} onClick={() => { this.setState({ failed: false }); this.props.onHome(); }}>Go home</button></main>;
    return this.props.children;
  }
}
function RoutedContent({ children }: { children?: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [recovered, setRecovered] = useState(false);
  return <RouteBoundary key={location.key} onHome={() => { setRecovered(true); navigate('/'); }}>{!recovered && children ? children : <Routes><Route path="/" element={<Landing />} /><Route path="/resumes" element={<LibraryPage />} /><Route path="/resumes/trash" element={<TrashPage />} /><Route path="/resumes/import" element={<ImportPage />} /><Route path="/resumes/:resumeId/edit" element={<EditorPage />} /><Route path="/sign-up" element={<SignUp />} /><Route path="/login" element={<Login />} /><Route path="/verify-email" element={<VerifyEmail />} /><Route path="/reset-password" element={<ResetPassword />} /><Route path="/reset-password/confirm" element={<ResetPassword confirm />} /><Route path="/account" element={<Account />} /><Route path="/auth/sign-up" element={<Navigate to="/sign-up" replace />} /><Route path="/auth/login" element={<Navigate to="/login" replace />} /><Route path="/auth/verify-email" element={<Navigate to={`/verify-email${location.hash}`} replace />} /><Route path="/auth/password-reset" element={<Navigate to="/reset-password" replace />} /><Route path="/auth/password-reset/confirm" element={<Navigate to={`/reset-password/confirm${location.hash}`} replace />} /><Route path="*" element={<NotFound />} /></Routes>}</RouteBoundary>;
}
function Landing() { return <main id="main-content"><h1>Resumiser</h1><p>Create, edit and export your resumes.</p><Link to="/resumes">Open your resumes</Link></main>; }
function NotFound() { return <main id="main-content"><h1>Page not found</h1><p>This page does not exist.</p><Link to="/">Go home</Link></main>; }
export function App({ children }: { children?: ReactNode }) {
  return <BrowserRouter><SessionProvider><a className="skip-link" href="#main-content">Skip to main content</a><header><Link className="brand" to="/">Resumiser</Link><nav aria-label="Primary"><Link to="/resumes">Resumes</Link><Link to="/account">Account</Link></nav><ThemeSwitch /></header><RoutedContent>{children}</RoutedContent></SessionProvider></BrowserRouter>;
}
