import { useCompany } from '@/context/CompanyProvider.tsx';
import GoHome from '@/components/GoHome.tsx';
import { useCallback, useEffect, useState } from 'react';
import type { LocalTables } from '../../tables';
import { deleteRecord, read } from '@/hooks/dbUtil.ts';
import { errorToast, formatCurrency } from '@/lib/myUtils.tsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.tsx';
import AccountHeadCrud from '@/components/AccountHeadCrud.tsx';
import { Button } from '@/components/ui/button.tsx';
import ConfirmationDialog from '@/components/ConfirmationDialog.tsx';

export default function AccountHead() {
  const { company } = useCompany();
  const [accountHeads, setAccountHeads] = useState<
    LocalTables<'account_head'>[]
  >([]);

  const loadAccountHeads = useCallback(async () => {
    if (!company?.name) return;

    try {
      const accountHead = await read('account_head', { company: company.name });

      const sorted =
        accountHead?.sort((a, b) => a.name.localeCompare(b.name)) ?? [];
      setAccountHeads(sorted);
    } catch (error) {
      errorToast(error);
    }
  }, [company?.name]);

  const deleteAccountHead = async (
    accountHead: LocalTables<'account_head'>
  ) => {
    try {
      await deleteRecord('account_head', {
        name: accountHead.name,
        code: accountHead.code,
        company: company?.name,
      });
      await loadAccountHeads();
    } catch (error) {
      errorToast(error);
    }
  };

  useEffect(() => {
    void loadAccountHeads();
  }, [loadAccountHeads]);

  return (
    <div className="w-6/10 mx-auto pb-10">
      <div className="flex gap-4 items-center">
        <GoHome />
        <div className="text-xl">Account Head</div>
        <AccountHeadCrud onSave={() => void loadAccountHeads()} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Opening Balance</TableHead>
            <TableHead>Group</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accountHeads.map((accountHead) => (
            <TableRow key={accountHead.code}>
              <TableCell className="py-1.5">{accountHead.name}</TableCell>
              <TableCell className="text-right py-0">
                {formatCurrency(accountHead.opening_balance)}
              </TableCell>
              <TableCell className="py-0">{accountHead.hisaab_group}</TableCell>
              <TableCell>
                <AccountHeadCrud
                  label={
                    <Button variant="link" className="cursor-pointer h-6">
                      Edit
                    </Button>
                  }
                  accountHead={accountHead}
                  onSave={() => void loadAccountHeads()}
                />
                <ConfirmationDialog
                  trigger={
                    <Button variant="link" className="cursor-pointer h-6">
                      Delete
                    </Button>
                  }
                  title={`Delete ${accountHead.name}?`}
                  onConfirm={() => deleteAccountHead(accountHead)}
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
