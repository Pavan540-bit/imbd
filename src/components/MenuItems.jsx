import Link from 'next/link'
import React from 'react'

const MenuItems = ({title,address,icon}) => {
  return (
    <>
      <Link href={address} className='mx-4 lg:mx-6 hover:text-amber-500'>
     <span className='text-2xl sm:hidden mx-2'>{icon}</span>
      <span className='hidden sm:inline my-2 text-sm'>{title}</span>
      </Link>
    </>
  )
}

export default MenuItems
