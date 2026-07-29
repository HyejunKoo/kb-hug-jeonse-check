-- 보증 실행 전 선행조치가 필요한 진단을 통계·이력에서도 별도로 보존한다.
alter type public.overall_status add value if not exists 'needs_action';
