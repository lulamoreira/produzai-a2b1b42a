import { useEffect, useState, createContext, useContext } from "react";

const KEY = "preview_user_id";
const NAME_KEY = "preview_user_name";

type Ctx = { previewUserId: string | null; previewUserName: string | null; exitPreview: () => void };
const PreviewCtx = createContext<Ctx>({ previewUserId: null, previewUserName: null, exitPreview: () => {} });

export const PreviewUserProvider = ({ children }: { children: React.ReactNode }) => {
  const [previewUserId, setId] = useState<string | null>(() => sessionStorage.getItem(KEY));
  const [previewUserName, setName] = useState<string | null>(() => sessionStorage.getItem(NAME_KEY));

  useEffect(() => {
    const url = new URL(window.location.href);
    const p = url.searchParams.get("preview_as");
    const n = url.searchParams.get("preview_name");
    if (p) {
      sessionStorage.setItem(KEY, p);
      if (n) sessionStorage.setItem(NAME_KEY, n);
      setId(p);
      setName(n);
      url.searchParams.delete("preview_as");
      url.searchParams.delete("preview_name");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const exitPreview = () => {
    sessionStorage.removeItem(KEY);
    sessionStorage.removeItem(NAME_KEY);
    setId(null);
    setName(null);
    window.location.href = "/";
  };

  return <PreviewCtx.Provider value={{ previewUserId, previewUserName, exitPreview }}>{children}</PreviewCtx.Provider>;
};

export const usePreviewUser = () => useContext(PreviewCtx);
