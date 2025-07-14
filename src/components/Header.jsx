import React from 'react'
import MenuItems from './MenuItems'
import { FaHome } from 'react-icons/fa'
import { FcAbout } from 'react-icons/fc'
import Link from 'next/link'
import DarkMode from './DarkMode'
// import { MdDarkMode } from "react-icons/md";
// import { MdOutlineLightMode } from "react-icons/md";
import Providers from '../app/Providers'


const Header = () => {
  return (
    <>
    <Providers>
      <div className='flex justify-between items-center mx-2  sm:mx-auto py-6 header-class'>
        <div className='flex'>
          <MenuItems title={'Home'} address={'/'} icon={<FaHome />} />
          <MenuItems title={'About'} address={'/about'} icon={<FcAbout />} />
        </div>
        <div className='flex items-center space-x-5'>
          <DarkMode />
          <Link href="/" >
            <h2 className='text-2xl'>
              <span className='font-bold bg-amber-500 py-1 px-2 rounded-lg'>IMDb</span>
              <span className='text-xl hidden sm:inline'>clone</span>
            </h2></Link>
        </div>
      </div>
      </Providers>
    </>
  )
}

export default Header
