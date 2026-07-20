import LegalPage from '../../components/LegalPage';
import SiteFooter from '../../components/SiteFooter';
import SiteHeader from '../../components/SiteHeader';

export default function EULAPage() {
  return (
    <>
      <SiteHeader />
      <LegalPage documentKey="eula" />
      <SiteFooter />
    </>
  );
}
