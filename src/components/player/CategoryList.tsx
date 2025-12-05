import { ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import SearchInput from './SearchInput';

interface Category {
  id: string;
  title: string;
  alias?: string;
}

interface CategoryListProps {
  categories: Category[];
  selectedCategory: string | null;
  onCategorySelect: (id: string) => void;
  loading: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export default function CategoryList({
  categories,
  selectedCategory,
  onCategorySelect,
  loading,
  searchQuery,
  onSearchChange
}: CategoryListProps) {
  const filteredCategories = categories.filter(cat =>
    cat.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="border-b border-white/10 flex flex-col h-full">
      <div className="p-3 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-zinc-950 sticky top-0">
        Categories
      </div>
      
      <div className="p-3 border-b border-white/10 bg-zinc-950">
        <SearchInput
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Search categories..."
        />
      </div>
      
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800">
        {loading ? (
          <div className="p-4 text-center text-gray-500 text-sm">Loading...</div>
        ) : (
          filteredCategories.map(cat => (
            <button
              key={cat.id}
              onClick={() => onCategorySelect(cat.id)}
              className={clsx(
                "w-full text-left px-4 py-3 text-sm transition-colors flex items-center justify-between group",
                selectedCategory === cat.id
                  ? "bg-blue-600/10 text-blue-400 border-r-2 border-blue-500"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <span className="truncate">{cat.title}</span>
              <ChevronRight className={clsx("w-3 h-3 transition-transform", selectedCategory === cat.id ? "opacity-100" : "opacity-0 group-hover:opacity-50")} />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
