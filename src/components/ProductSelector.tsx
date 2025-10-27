import type { MetalType, ProductType } from '../../tables';
import { useEffect, useState } from 'react';
import { getDBMethods } from '@/hooks/dbUtil.ts';
import SearchSelect from '@/components/SearchSelect.tsx';
import { decode } from '@/lib/thanglish/TsciiConverter.ts';
import MyCache from '@/lib/MyCache.ts';

export default function ProductSelector(props: {
  productType: ProductType;
  metalType: MetalType;
  value?: string;
  inputName?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  triggerWidth?: string;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
}) {
  const [products, setProducts] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<string[]>([]);

  useEffect(() => {
    const run = async () => {
      const cache = new MyCache<string[]>(
        `${props.metalType}-${props.productType}`
      );
      if (cache.has('products')) {
        setProducts(cache.get('products') ?? []);
        return;
      }
      const response = await getDBMethods('products').read({
        metal_type: props.metalType,
        product_type: props.productType,
      });
      if (response.success && response.data) {
        const productNames = response.data
          .map((item) => decode(item.name))
          .sort((a, b) => a.localeCompare(b));
        setProducts(productNames);
        cache.set('products', productNames);
      } else {
        setProducts([]);
      }
    };
    void run();
  }, [props.metalType, props.productType]);

  useEffect(() => {
    if (!search.trim()) {
      setFilteredProducts([]);
      return;
    }
    const productNames = [
      ...new Set([
        ...products.filter((item) =>
          item.toLowerCase().startsWith(search.toLowerCase())
        ),
        ...products.filter((item) =>
          item.toLowerCase().includes(search.toLowerCase())
        ),
      ]),
    ];
    setFilteredProducts(productNames);
  }, [products, search]);

  return (
    <SearchSelect
      options={filteredProducts}
      value={props.value}
      onSearchChange={setSearch}
      inputName={props.inputName}
      placeholder={props.placeholder}
      onChange={props.onChange}
      triggerWidth={props.triggerWidth}
      onKeyDown={props.onKeyDown}
      onFocus={props.onFocus}
    />
  );
}
