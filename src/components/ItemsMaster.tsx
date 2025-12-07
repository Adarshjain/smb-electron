import GoHome from '@/components/GoHome.tsx';
import { useCallback, useEffect, useState } from 'react';
import { deleteRecord, read } from '@/hooks/dbUtil.ts';
import type { LocalTables, ProductType } from '../../tables';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.tsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.tsx';
import { Button } from '@/components/ui/button.tsx';
import ConfirmationDialog from '@/components/ConfirmationDialog.tsx';
import { errorToast, successToast } from '@/lib/myUtils.tsx';
import { Input } from '@/components/ui/input';
import { useThanglish } from '@/context/ThanglishProvider.tsx';

export default function ItemsMaster() {
  const { convert } = useThanglish();
  const [productType, setProductType] = useState<ProductType>('product');
  const [fetchedItems, setFetchedItems] = useState<LocalTables<'products'>[]>(
    []
  );
  const [filteredItems, setFilteredItems] = useState<LocalTables<'products'>[]>(
    []
  );
  const [search, setSearch] = useState('');

  const filterProducts = useCallback(() => {
    if (!search.trim()) {
      setFilteredItems(fetchedItems);
      return;
    }
    setFilteredItems([
      ...new Set([
        ...fetchedItems.filter((item) =>
          item.name.toLowerCase().startsWith(search.toLowerCase())
        ),
        ...fetchedItems.filter((item) =>
          item.name.toLowerCase().includes(search.toLowerCase())
        ),
      ]),
    ]);
  }, [fetchedItems, search]);

  useEffect(() => {
    filterProducts();
  }, [filterProducts]);

  const fetchAll = useCallback(async () => {
    const products = await read('products', { product_type: productType });
    setFetchedItems(products ?? []);
    setFilteredItems(products ?? []);
  }, [productType]);

  const deleteItem = async (item: LocalTables<'products'>) => {
    try {
      await deleteRecord('products', item);
      await fetchAll();
      successToast('Deleted!');
    } catch (error) {
      errorToast(error);
    }
  };

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  return (
    <div className="w-5/10 mx-auto">
      <div className="flex items-center my-2">
        <GoHome />
        <div className="text-lg">Items Master</div>
        <Input
          value={search}
          onChange={(e) => setSearch(convert(e.target.value))}
          placeholder="Search..."
          className="w-auto ml-auto"
        />
        <Select
          onValueChange={(value) => setProductType(value as ProductType)}
          value={productType}
        >
          <SelectTrigger className="w-[200px] ml-4">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="product">Product</SelectItem>
            <SelectItem value="quality">Quality</SelectItem>
            <SelectItem value="seal">Seal</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredItems.map((item) => (
            <TableRow key={item.name}>
              <TableCell className="py-1.5">{item.name}</TableCell>
              <TableCell>
                <ConfirmationDialog
                  trigger={
                    <Button variant="link" className="cursor-pointer h-6">
                      Delete
                    </Button>
                  }
                  title={`Delete ${item.name}?`}
                  onConfirm={() => deleteItem(item)}
                  confirmText="Delete"
                  isDestructive
                  autoFocus
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
