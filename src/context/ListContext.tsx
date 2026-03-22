import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ListContextType {
  listId: number;
  setListId: (id: number) => void;
}

const ListContext = createContext<ListContextType | undefined>(undefined);

export const useListContext = () => {
  const context = useContext(ListContext);
  if (!context) {
    throw new Error('useListContext must be used within a ListProvider');
  }
  return context;
};

interface ListProviderProps {
  children: ReactNode;
  initialListId?: number;
}

export const ListProvider: React.FC<ListProviderProps> = ({ children, initialListId = 1 }) => {
  const [listId, setListId] = useState(initialListId);

  return (
    <ListContext.Provider value={{ listId, setListId }}>
      {children}
    </ListContext.Provider>
  );
}; 