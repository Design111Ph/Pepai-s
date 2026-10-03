import React, { useState } from 'react';
import {
  UserCheck,
  Fingerprint,
  KeyRound,
  ShieldAlert,
  CheckCircle2,
  X,
  Lock,
} from 'lucide-react';
import { User, UserRole } from '../types';
import { INITIAL_USERS } from '../data/initialData';

interface AuthModalProps {
  currentUser: User;
  onSelectUser: (user: User) => void;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  currentUser,
  onSelectUser,
  onClose,
}) => {
  const [selectedUser, setSelectedUser] = useState<User>(currentUser);
  const [authStep, setAuthStep] = useState<'pick' | 'biometric'>('pick');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [biometricSuccess, setBiometricSuccess] = useState<boolean>(false);

  const handlePickUser = (user: User) => {
    setSelectedUser(user);
    if (user.role === 'admin' || user.role === 'manager') {
      setAuthStep('biometric');
    } else {
      onSelectUser(user);
      onClose();
    }
  };

  const handleTriggerBiometric = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setBiometricSuccess(true);
      setTimeout(() => {
        onSelectUser(selectedUser);
        onClose();
      }, 900);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-amber-500" />
            <h3 className="text-base font-black text-neutral-900 dark:text-white">
              Role-Based User Switcher
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {authStep === 'pick' ? (
          <div className="space-y-3">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Select a staff profile to test permissions isolation between Owner, Manager, Head Chef, and Prep Line Cooks.
            </p>

            <div className="space-y-2">
              {INITIAL_USERS.map((user) => {
                const isActive = user.id === currentUser.id;

                return (
                  <div
                    key={user.id}
                    onClick={() => handlePickUser(user)}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      isActive
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-neutral-200 dark:border-neutral-800 hover:border-amber-500/40 bg-neutral-50 dark:bg-neutral-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-9 h-9 rounded-full object-cover border border-neutral-300 dark:border-neutral-700"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-neutral-900 dark:text-white">
                            {user.name}
                          </span>
                          {user.biometricEnabled && (
                            <span title="Biometrics Enabled">
                              <Fingerprint className="w-3.5 h-3.5 text-emerald-500" />
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold block">
                          {user.roleTitle}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        user.role === 'admin'
                          ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300'
                          : user.role === 'manager'
                          ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                          : user.role === 'chef'
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                          : 'bg-neutral-500/15 text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      {user.role}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Biometric Verification Step */
          <div className="py-4 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
              <Fingerprint
                className={`w-10 h-10 ${isScanning ? 'animate-pulse text-sky-500 scale-110 transition-transform' : ''}`}
              />
            </div>

            <div>
              <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                Biometric Verification Required
              </h4>
              <p className="text-xs text-neutral-500 mt-1">
                Authenticating as <strong>{selectedUser.name}</strong> ({selectedUser.roleTitle})
              </p>
            </div>

            {biometricSuccess ? (
              <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1.5 animate-bounce">
                <CheckCircle2 className="w-4 h-4" />
                <span>Biometric WebAuthn Credential Verified!</span>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={handleTriggerBiometric}
                  disabled={isScanning}
                  className="w-full py-2.5 rounded-xl text-xs font-bold bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2"
                >
                  <Fingerprint className="w-4 h-4" />
                  <span>{isScanning ? 'Verifying TouchID / FaceID...' : 'Scan Biometric Passkey'}</span>
                </button>

                <button
                  onClick={() => {
                    onSelectUser(selectedUser);
                    onClose();
                  }}
                  className="text-[11px] text-neutral-400 hover:underline"
                >
                  Bypass with Master PIN (Admin Override)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
