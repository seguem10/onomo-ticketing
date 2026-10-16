-- LOCAL synthetic fixture only; assertions fail the psql run on regression.
set role authenticated;
set test.uid='00000000-0000-0000-0000-000000000001';
set test.role='it_hotel';set test.hotels='FAKE-A';
do $$declare affected integer; begin
 if not exists(select 1 from tickets where hotel='FAKE-A') then raise exception 'IT loses assigned hotel';end if;
 if exists(select 1 from tickets where hotel='FAKE-B') then raise exception 'IT sees removed hotel';end if;
 update tickets set titre='Denied' where hotel='FAKE-B';get diagnostics affected=row_count;
 if affected<>0 then raise exception 'IT updates removed hotel';end if;
 update tickets set titre='Allowed' where hotel='FAKE-A';get diagnostics affected=row_count;
 if affected<>1 then raise exception 'IT cannot update permitted hotel';end if;
 begin insert into tickets values('00000000-0000-0000-0000-000000000105','FAKE-B',auth.uid(),null,'Denied');raise exception 'IT creates outside scope';
 exception when insufficient_privilege then null;end;
 raise notice 'PASS: local IT read A, deny B including former assignment, deny update B, update A, deny insert B';
end$$;
set test.role='it_regional';set test.hotels='FAKE-A,FAKE-B';
do $$begin if (select count(*) from tickets)<>3 then raise exception 'Regional loses assigned hotels';end if;raise notice 'PASS: regional assigned hotels';end$$;
set test.role='admin';set test.hotels='';
do $$begin if (select count(*) from tickets)<>3 then raise exception 'Admin loses access';end if;raise notice 'PASS: admin global access';end$$;
set test.role='requester';set test.uid='00000000-0000-0000-0000-000000000099';
do $$begin if (select count(*) from tickets)<>3 then raise exception 'Requester owner read behavior changed';end if;raise notice 'PASS: requester ownership unchanged';end$$;
reset role;
