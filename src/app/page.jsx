
'use client'

import React from "react";
import Header from "../components/Header";
export default function Home() {

  const countries = [
    { name: 'India', region: 'Asia' },
    { name: 'Germany', region: 'Europe' },
    { name: 'Japan', region: 'Asia' },
    { name: 'Brazil', region: 'South America' }
  ];



  return (
    <>
       <Header />
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <h1 className="text-blue-400 text-3xl">imbd clone</h1>


        <ul>
          {countries
            .filter((data) => data.region === 'Asia')
            .map((data, index) => (
              <li key={index}>{data.name}</li>
            ))}
        </ul>




      </main>

    </div>
    </>
  );
}
