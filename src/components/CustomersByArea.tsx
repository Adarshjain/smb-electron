import { useCallback, useEffect, useState } from 'react';
import type { LocalTables, Tables } from '../../tables';
import { read } from '@/hooks/dbUtil.ts';
import AreaSelector from '@/components/AreaSelector.tsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import GoHome from '@/components/GoHome.tsx';

export default function CustomersByArea() {
  const [areas, setAreas] = useState<LocalTables<'areas'>[]>([]);
  const [areaByName, setAreaByName] = useState<
    Record<string, LocalTables<'areas'>>
  >({});
  const [customers, setCustomers] = useState<LocalTables<'customers'>[]>([]);

  const fetchAreas = useCallback(async () => {
    const fetchedAreas = (await read('areas', {})) ?? [];

    const areaMap: Record<string, LocalTables<'areas'>> = {};
    fetchedAreas.forEach((area) => (areaMap[area.name] = area));
    setAreas(fetchedAreas);
    setAreaByName(areaMap);
  }, []);

  const fetchCustomersByArea = useCallback(async (area: Tables['areas']) => {
    setCustomers(
      (await read('customers', {
        area: area.name,
      })) ?? []
    );
  }, []);

  useEffect(() => {
    void fetchAreas();
  }, [fetchAreas]);

  return (
    <div className="p-4 gap-4 flex flex-col">
      <div className="flex gap-6 items-center">
        <GoHome />
        <AreaSelector
          options={areas}
          onChange={(area) => void fetchCustomersByArea(area)}
          placeholder="Search Area..."
        />
        {customers.length ? (
          <div>
            {areaByName[customers[0].area]
              ? `Post: ${areaByName[customers[0].area].post}`
              : ''}{' '}
            {areaByName[customers[0].area].town}{' '}
            {areaByName[customers[0].area].pincode}
          </div>
        ) : null}
      </div>
      {customers.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="border-r">Name</TableHead>
              <TableHead className="border-r">FHName</TableHead>
              <TableHead className="border-r">Address</TableHead>
              <TableHead className="border-r">Phone Number</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell className="border-r">{customer.name}</TableCell>
                <TableCell className="border-r">
                  <span className="w-8 border-r inline-block">
                    {customer.fhtitle}
                  </span>{' '}
                  {customer.fhname}
                </TableCell>
                <TableCell className="border-r">
                  <div>
                    {customer.door_no} {customer.address1}
                  </div>
                  {customer.address2 && <div>{customer.address2}</div>}
                </TableCell>
                <TableCell className="border-r">{customer.phone_no}</TableCell>
                <TableCell className="border-r">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6"
                    onClick={console.log}
                  >
                    View Loans
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </div>
  );
}
