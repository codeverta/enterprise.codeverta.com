let navigate = null;

export const setNavigate = (navigateFunction) => {
    navigate = navigateFunction;
};

export const redirectToLogin = () => {
    if (navigate) {
        navigate('/');
    } else {
        // Fallback to window.location
        window.location.href = '/';
    }
};
