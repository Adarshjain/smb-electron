import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { toEnglish, toTamil } from '../lib/thanglish/thanglish.ts';

interface ThanglishContextType {
  isTamil: boolean;
  setIsTamil: (isTamil: boolean) => void;
  convert: (input: string) => string;
}

const ThanglishContext = createContext<ThanglishContextType | undefined>(
  undefined
);

export function ThanglishProvider({ children }: { children: ReactNode }) {
  const [isTamil, setIsTamil] = useState<boolean>(true);

  // Toggle isTamil when F10 is pressed
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F12') {
        event.preventDefault();
        setIsTamil((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const convert = useCallback(
    (input: string) => {
      if (!input.trim()) return input;

      const words = input.split(' ');
      const lastWordIndex = words.length - 1;
      if (isTamil) {
        words[lastWordIndex] = toTamil(toEnglish(words[lastWordIndex]));
      } else {
        words[lastWordIndex] = toEnglish(words[lastWordIndex]);
      }

      return words.join(' ');
    },
    [isTamil]
  );

  const value = useMemo(
    () => ({
      isTamil,
      setIsTamil,
      convert,
    }),
    [isTamil, convert]
  );

  return (
    <ThanglishContext.Provider value={value}>
      {children}
    </ThanglishContext.Provider>
  );
}

export function useThanglish() {
  const context = useContext(ThanglishContext);
  if (!context) {
    throw new Error('useThanglish must be used within a ThanglishProvider');
  }
  return context;
}
