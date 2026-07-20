import LegalPage from '../../components/LegalPage';
import SiteFooter from '../../components/SiteFooter';
import SiteHeader from '../../components/SiteHeader';

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <LegalPage documentKey="privacyPolicy" />
      <SiteFooter />
    </>
  );
}