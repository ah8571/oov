import LegalPage from '../../components/LegalPage';
import SiteFooter from '../../components/SiteFooter';
import SiteHeader from '../../components/SiteHeader';

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <LegalPage documentKey="termsOfService" />
      <SiteFooter />
    </>
  );
}