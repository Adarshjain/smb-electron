import type {MetalType} from "../../tables";
import {useEffect, useState} from "react";
import {getDBMethods} from "@/hooks/dbUtil.ts";
import SearchSelect from "@/components/SearchSelect.tsx";
import {decode} from "@/lib/thanglish/TsciiConverter.ts";

export default function ProductSelector(props: { metalType: MetalType }) {
    const [products, setProducts] = useState<string[]>([]);
    const [search, setSearch] = useState('');
    const [filteredProducts, setFilteredProducts] = useState<string[]>([]);

    useEffect(() => {
        const run = async () => {
            const response = await getDBMethods('products').read({
                metal_type: props.metalType,
                product_type: 'product',
            });
            if (response.success && response.data) {
                const productNames = response.data.map(item => decode(item.name));
                setProducts(productNames);
                setFilteredProducts(productNames);
            } else {
                setProducts([]);
            }
        }
        run();
    }, [props.metalType]);

    useEffect(() => {
        if (!search.trim()) {
            setFilteredProducts([]);
        }
        const productNames = products.filter(item => item.includes(search));
        setFilteredProducts(productNames);
    }, [products, props.metalType, search]);

    return <SearchSelect options={filteredProducts} onSearchChange={setSearch}/>
}