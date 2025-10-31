import { Button } from '@/components/ui/button';

export default function BottomBar({
  isEditMode,
  onNewClick,
  onLastClick,
  onSaveClick,
  onPrevClick,
  onNextClick,
  onDeleteClick,
}: {
  isEditMode: boolean;
  onSaveClick: () => void;
  onLastClick: () => void;
  onPrevClick: () => void;
  onNextClick: () => void;
  onNewClick: () => void;
  onDeleteClick: () => void;
}) {
  return (
    <div className="flex justify-between w-full fixed bottom-0 py-3 border-t bg-gray-100 border-gray-200">
      <div className="flex ml-6">
        <Button
          variant="outline"
          className="border-black rounded-r-none"
          onClick={onLastClick}
        >
          Last
        </Button>
        <Button
          variant="outline"
          className="border-black border-x-0 rounded-none"
          onClick={onPrevClick}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          className="border-black rounded-l-none"
          onClick={onNextClick}
        >
          Next
        </Button>
      </div>
      <div className="flex mr-6">
        <Button
          variant="outline"
          className="border-black rounded-r-none hover:bg-destructive hover:text-white hover:border-destructive px-7"
          onClick={onDeleteClick}
          disabled={!isEditMode}
        >
          Delete
        </Button>
        <Button
          variant="outline"
          className="border-black border-x-0 rounded-none px-7"
          onClick={onNewClick}
          disabled={!isEditMode}
        >
          New
        </Button>
        <Button
          className="border-black rounded-l-none px-7"
          onClick={onSaveClick}
        >
          {isEditMode ? 'Save' : 'Create'}
        </Button>
      </div>
    </div>
  );
}
