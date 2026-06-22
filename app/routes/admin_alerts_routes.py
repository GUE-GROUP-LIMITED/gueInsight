from flask import request, redirect, url_for, flash
from flask_login import current_user, login_required


def register_admin_alerts_routes(admin_bp):
    from app.routes import admin_routes as ar

    @admin_bp.route('/alerts')
    @login_required
    def admin_alerts():
        ar.check_admin_role(current_user)
        alerts = ar.Alert.query.join(ar.Alert.event).filter_by(source='analysis').all()
        return {"alerts": [a.to_dict() for a in alerts]}

    @admin_bp.route('/alert_rules', methods=['GET', 'POST'])
    @login_required
    def admin_alert_rules():
        ar.check_admin_role(current_user)
        form = ar.AlertRuleForm()
        global_rules = ar.AlertRule.query.filter_by(user_id=None).all()
        if form.validate_on_submit():
            new_rule = ar.AlertRule(
                user_id=None,
                rule_type=form.rule_type.data,
                value=form.value.data,
                severity=form.severity.data,
                enabled=form.enabled.data
            )
            ar.db.session.add(new_rule)
            ar.db.session.commit()
            flash('Global alert rule created successfully.', 'success')
            return redirect(url_for('admin.admin_alert_rules'))
        return {"alert_rules": [r.to_dict() for r in global_rules]}

    @admin_bp.route('/alert_rules/edit/<int:rule_id>', methods=['GET', 'POST'])
    @login_required
    def edit_admin_alert_rule(rule_id):
        ar.check_admin_role(current_user)
        rule = ar.AlertRule.query.get_or_404(rule_id)
        if rule.user_id is not None:
            flash('Not a global rule.', 'danger')
            return redirect(url_for('admin.admin_alert_rules'))
        form = ar.AlertRuleForm(obj=rule)
        if form.validate_on_submit():
            rule.rule_type = form.rule_type.data
            rule.value = form.value.data
            rule.severity = form.severity.data
            rule.enabled = form.enabled.data
            ar.db.session.commit()
            flash('Global alert rule updated.', 'success')
            return redirect(url_for('admin.admin_alert_rules'))
        return {"rule": rule.to_dict()}

    @admin_bp.route('/alert_rules/delete/<int:rule_id>', methods=['POST'])
    @login_required
    def delete_admin_alert_rule(rule_id):
        ar.check_admin_role(current_user)
        rule = ar.AlertRule.query.get_or_404(rule_id)
        if rule.user_id is not None:
            flash('Not a global rule.', 'danger')
            return redirect(url_for('admin.admin_alert_rules'))
        ar.db.session.delete(rule)
        ar.db.session.commit()
        flash('Global alert rule deleted.', 'success')
        return redirect(url_for('admin.admin_alert_rules'))

    @admin_bp.route('/alert_rules/toggle/<int:rule_id>', methods=['POST'])
    @login_required
    def toggle_admin_alert_rule(rule_id):
        ar.check_admin_role(current_user)
        rule = ar.AlertRule.query.get_or_404(rule_id)
        if rule.user_id is not None:
            flash('Not a global rule.', 'danger')
            return redirect(url_for('admin.admin_alert_rules'))
        rule.enabled = not rule.enabled
        ar.db.session.commit()
        flash('Global alert rule status updated.', 'success')
        return redirect(url_for('admin.admin_alert_rules'))
