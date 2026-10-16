interface Props {
  page: number;
  totalPages: number;
  total: number;
  onPage: (page: number) => void;
}

export const Pagination = ({ page, totalPages, total, onPage }: Props) => {
  if (totalPages <= 1) return null;
  return (
    <div className="pagination">
      <button disabled={page <= 1} onClick={() => onPage(page - 1)}>
        ← Prev
      </button>
      <span>
        Page {page} of {totalPages} ({total} total)
      </span>
      <button disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        Next →
      </button>
    </div>
  );
};
