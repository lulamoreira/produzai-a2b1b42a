-- Run against an isolated PostgreSQL database containing the execution schema and RPC.
BEGIN;
SELECT set_config('test.uid','00000000-0000-0000-0000-000000000099',true);
INSERT INTO campaigns VALUES ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010'),('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000010'),('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000011');
INSERT INTO client_stores VALUES ('00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000010'),('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000010');
INSERT INTO installation_teams(id,campaign_id,name,coverage_scope,coverage_values) VALUES ('00000000-0000-0000-0000-000000000030','00000000-0000-0000-0000-000000000001','Shared','all','{}'),('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000001','New','state','{SP}'),('00000000-0000-0000-0000-000000000032','00000000-0000-0000-0000-000000000002','Shared','none','{}');
INSERT INTO installation_team_members(team_id,name,rg,cpf,phone,is_leader) VALUES ('00000000-0000-0000-0000-000000000031','Installer','RG123','CPF123','1234',true);
INSERT INTO installation_team_vehicles(team_id,name,brand,color,plate) VALUES ('00000000-0000-0000-0000-000000000031','Van','Brand','White','ABC123');
INSERT INTO campaign_schedules(id,campaign_id,store_id,team_id,scheduled_date,scheduled_time,installation_os,installation_preference,store_approval_status,completed_at,photo_checkin,checkin_lat,install_code) VALUES
('00000000-0000-0000-0000-000000000040','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000031','2026-10-20','18:00','OS123','night','approved',now(),true,12.3,'secret-code'),
('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000030','2026-10-20','19:00','SOURCE',NULL,'under_review',NULL,false,NULL,NULL),
('00000000-0000-0000-0000-000000000042','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000021',NULL,'2026-10-22','20:00','KEEP',NULL,'under_review',NULL,false,NULL,NULL);
INSERT INTO installation_photos(campaign_id,store_id,photo_url,category) VALUES ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000020','https://example.test/photo.jpg','front');
DO $$ DECLARE result jsonb; s campaign_schedules%ROWTYPE; snapshot jsonb;
BEGIN
 SELECT jsonb_agg(to_jsonb(cs) ORDER BY id) INTO snapshot FROM campaign_schedules cs WHERE campaign_id='00000000-0000-0000-0000-000000000001';
 result:=import_campaign_execution('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',true,false);
 IF result <> '{"schedules_imported":1,"schedules_skipped":1,"teams_created":1,"teams_reused":1,"photos_imported":0}'::jsonb THEN RAISE EXCEPTION 'Wrong summary: %',result; END IF;
 SELECT * INTO s FROM campaign_schedules WHERE campaign_id='00000000-0000-0000-0000-000000000002' AND store_id='00000000-0000-0000-0000-000000000020';
 IF s.id='00000000-0000-0000-0000-000000000040' OR s.team_id='00000000-0000-0000-0000-000000000031' OR s.installation_os<>'OS123' OR s.installation_preference<>'night' OR s.store_approval_status<>'approved' THEN RAISE EXCEPTION 'Copy or mapping failed'; END IF;
 IF s.completed_at IS NOT NULL OR s.photo_checkin OR s.checkin_lat IS NOT NULL OR s.install_code IS NOT NULL THEN RAISE EXCEPTION 'Execution leaked into schedules-only import'; END IF;
 IF (SELECT installation_os FROM campaign_schedules WHERE id='00000000-0000-0000-0000-000000000042')<>'KEEP' THEN RAISE EXCEPTION 'Existing target modified'; END IF;
 IF snapshot IS DISTINCT FROM (SELECT jsonb_agg(to_jsonb(cs) ORDER BY id) FROM campaign_schedules cs WHERE campaign_id='00000000-0000-0000-0000-000000000001') THEN RAISE EXCEPTION 'Source modified'; END IF;
 IF (SELECT count(*) FROM installation_team_members m JOIN installation_teams t ON t.id=m.team_id WHERE t.campaign_id='00000000-0000-0000-0000-000000000002' AND m.rg='RG123')<>1 THEN RAISE EXCEPTION 'Members not copied'; END IF;
 IF (SELECT count(*) FROM installation_team_vehicles v JOIN installation_teams t ON t.id=v.team_id WHERE t.campaign_id='00000000-0000-0000-0000-000000000002' AND v.plate='ABC123')<>1 THEN RAISE EXCEPTION 'Vehicles not copied'; END IF;
 result:=import_campaign_execution('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',true,false);
 IF (result->>'schedules_imported')::int<>0 OR (result->>'schedules_skipped')::int<>2 OR (result->>'teams_created')::int<>0 THEN RAISE EXCEPTION 'Repeat import duplicated records'; END IF;
 BEGIN PERFORM import_campaign_execution('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003'); RAISE EXCEPTION 'Cross-client accepted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='Cross-client accepted' THEN RAISE; END IF; END;
 PERFORM set_config('test.allowed','false',true);
 BEGIN PERFORM import_campaign_execution('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002'); RAISE EXCEPTION 'Unauthorized accepted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='Unauthorized accepted' THEN RAISE; END IF; END;
 PERFORM set_config('test.allowed','true',true);
END $$;
-- New independent execution with photos and remapped reinstallation parent.
DELETE FROM campaign_schedules WHERE campaign_id='00000000-0000-0000-0000-000000000002';
INSERT INTO campaign_schedules(id,campaign_id,store_id,reinstall_seq,parent_installation_id,completed_at) VALUES ('00000000-0000-0000-0000-000000000043','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000020',1,'00000000-0000-0000-0000-000000000040',now());
DO $$ DECLARE result jsonb; parent uuid; photo_id uuid;
BEGIN
 result:=import_campaign_execution('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',true,true);
 IF (result->>'schedules_imported')::int<>3 OR (result->>'photos_imported')::int<>1 THEN RAISE EXCEPTION 'Execution import count failed'; END IF;
 SELECT parent_installation_id INTO parent FROM campaign_schedules WHERE campaign_id='00000000-0000-0000-0000-000000000002' AND reinstall_seq=1;
 IF NOT EXISTS(SELECT 1 FROM campaign_schedules WHERE id=parent AND campaign_id='00000000-0000-0000-0000-000000000002') THEN RAISE EXCEPTION 'Parent points outside target'; END IF;
 IF NOT EXISTS(SELECT 1 FROM campaign_schedules WHERE campaign_id='00000000-0000-0000-0000-000000000002' AND reinstall_seq=0 AND photo_checkin AND completed_at IS NOT NULL AND checkin_lat=12.3) THEN RAISE EXCEPTION 'Execution not copied'; END IF;
 SELECT id INTO photo_id FROM installation_photos WHERE campaign_id='00000000-0000-0000-0000-000000000002';
 result:=delete_installation_photo_record(photo_id);
 IF (result->>'remove_file')::boolean THEN RAISE EXCEPTION 'Shared original file would be removed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM installation_photos WHERE campaign_id='00000000-0000-0000-0000-000000000001') THEN RAISE EXCEPTION 'Source photo deleted'; END IF;
END $$;
-- Photos-only creates execution records but no teams or scheduled dates.
INSERT INTO campaigns VALUES ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000010');
DO $$ DECLARE result jsonb;
BEGIN
 result:=import_campaign_execution('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000004',false,true);
 IF (result->>'teams_created')::int<>0 OR (result->>'photos_imported')::int<>1 THEN RAISE EXCEPTION 'Photos-only imported teams or missed media'; END IF;
 IF EXISTS(SELECT 1 FROM campaign_schedules WHERE campaign_id='00000000-0000-0000-0000-000000000004' AND (scheduled_date IS NOT NULL OR team_id IS NOT NULL OR installation_os IS NOT NULL)) THEN RAISE EXCEPTION 'Photos-only imported scheduling fields'; END IF;
 IF NOT EXISTS(SELECT 1 FROM campaign_schedules WHERE campaign_id='00000000-0000-0000-0000-000000000004' AND photo_checkin AND checkin_lat=12.3) THEN RAISE EXCEPTION 'Photos-only lost check-in'; END IF;
END $$;
-- A failure after creating teams rolls back the entire RPC.
INSERT INTO campaigns VALUES ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000010');
CREATE FUNCTION test_reject_import() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.campaign_id='00000000-0000-0000-0000-000000000005' THEN RAISE EXCEPTION 'Injected failure'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER test_reject_import BEFORE INSERT ON campaign_schedules FOR EACH ROW EXECUTE FUNCTION test_reject_import();
DO $$ BEGIN
 BEGIN PERFORM import_campaign_execution('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000005',true,true); RAISE EXCEPTION 'Failure not triggered';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'Injected failure' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM installation_teams WHERE campaign_id='00000000-0000-0000-0000-000000000005') OR EXISTS(SELECT 1 FROM campaign_schedules WHERE campaign_id='00000000-0000-0000-0000-000000000005') OR EXISTS(SELECT 1 FROM installation_photos WHERE campaign_id='00000000-0000-0000-0000-000000000005') THEN RAISE EXCEPTION 'Partial import survived'; END IF;
END $$;
ROLLBACK;