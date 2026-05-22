import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useFirstLogin() {
  const { user } = useAuth();
  const [isFirstLogin, setIsFirstLogin] = useState<boolean | null>(null); // null = loading

  useEffect(() => {
    if (!user) {
      setIsFirstLogin(null);
      return;
    }
    
    const checkFirstLogin = async () => {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('first_login_at')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) {
        console.error("Error checking first login:", error);
        setIsFirstLogin(false);
        return;
      }

      setIsFirstLogin(profile?.first_login_at === null);
    };

    checkFirstLogin();
  }, [user]);

  const markFirstLoginDone = async () => {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update({ first_login_at: new Date().toISOString() })
      .eq('user_id', user.id);
    
    if (error) {
      console.error("Error marking first login as done:", error);
    } else {
      setIsFirstLogin(false);
    }
  };

  return { isFirstLogin, markFirstLoginDone };
}
