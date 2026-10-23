// Script to set admin users
// Run this in browser console when logged in, or import and call from your app

import { setAdminUser } from './adminUtils';

/**
 * Set both users as admin
 * Run this in browser console:
 * 
 * import { setAdmins } from './utils/setAdmins';
 * await setAdmins();
 */
export const setAdmins = async () => {
  try {
    // UID for qisam1989@gmail.com
    const qisamUID = 'SX26kFfwDRM70R4xVFECwg5QulG2';
    
    // UID for securefit2024@gmail.com (get full UID from Firebase Console)
    // Replace with the full UID from Authentication → Users
    const securefitUID = 'Xy2DEHEJNRQNN9MAnHqTZ...'; // Replace with full UID
    
    console.log('Setting qisam1989@gmail.com as admin...');
    await setAdminUser(qisamUID);
    console.log('✅ qisam1989@gmail.com set as admin');
    
    console.log('Setting securefit2024@gmail.com as admin...');
    await setAdminUser(securefitUID);
    console.log('✅ securefit2024@gmail.com set as admin');
    
    console.log('✅ Both users set as admin successfully!');
  } catch (error) {
    console.error('Error setting admins:', error);
    throw error;
  }
};

/**
 * Set admin for qisam1989@gmail.com
 */
export const setQisamAdmin = async () => {
  const qisamUID = 'SX26kFfwDRM70R4xVFECwg5QulG2';
  await setAdminUser(qisamUID);
  console.log('✅ qisam1989@gmail.com set as admin');
};

/**
 * Set admin for securefit2024@gmail.com
 * @param {string} uid - Full UID from Firebase Console
 */
export const setSecurefitAdmin = async (uid) => {
  await setAdminUser(uid);
  console.log('✅ securefit2024@gmail.com set as admin');
};
