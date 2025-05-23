"use client";

import dynamic from 'next/dynamic';

const EcommerceApp = dynamic(() => import('@/components/ecommerce-app'), { ssr: false });

export default function Home() {
  return <EcommerceApp />;
}
