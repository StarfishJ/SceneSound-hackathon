import '../styles/globals.css';
import Head from 'next/head';

function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>SceneSound</title>
        <link rel="icon" href="/downloads/logo.PNG" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}

export default MyApp; 