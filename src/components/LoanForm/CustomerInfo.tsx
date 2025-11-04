import type { Tables } from '@/../tables';

export default function CustomerInfo(props: {
  customer: Tables['customers']['Row'];
  area: Tables['areas']['Row'];
  className?: string;
}) {
  return (
    <div className={props.className}>
      <div>
        {props.customer.name} {props.customer.fhtitle} {props.customer.fhname}
      </div>
      {props.customer.address1 && props.customer.address1 !== '.' && (
        <div>
          {props.customer.door_no} {props.customer.address1},
        </div>
      )}
      <div>{props.customer.address2}</div>
      <div>
        {props.customer.area},
        {props.area && (
          <div>
            {props.area.post ? `Post: ${props.area.post}` : ''}{' '}
            {props.area.town} {props.area.pincode}
          </div>
        )}
      </div>
      <div>{props.customer.phone_no}</div>
    </div>
  );
}
