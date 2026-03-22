import { useCallback, useEffect, useState } from "react";
import { getLists } from "../database/database";
import { List } from "../database/models";

export const useLists = () => {
  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(false);
 
  const loadLists = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getLists();
      setLists(result);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);
 
  useEffect(() => { loadLists(); }, [loadLists]);
 
  return { lists, loading, loadLists };
};